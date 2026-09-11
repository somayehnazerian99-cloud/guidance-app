/**
 * Persistent local MongoDB for development.
 *
 *   node scripts/local-mongo.mjs start | stop | status
 *   npm run mongo:start / mongo:stop / mongo:status
 *
 * Uses the mongod binary that `npm install` already downloaded for
 * mongodb-memory-server (nothing is installed system-wide, no admin rights),
 * keeps its data in `.local-mongo/` and runs as a single-node replica set so
 * Prisma's transactions work.
 *
 * Start it once and `npm run dev` works against the DATABASE_URL in .env,
 * e.g. mongodb://localhost:27017/guidance
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { MongoClient } from "mongodb";
import { findEnvValue } from "./lib/env.mjs";

const ROOT = process.cwd();
const STATE_DIR = path.join(ROOT, ".local-mongo");
const DATA_DIR = path.join(STATE_DIR, "data");
const PID_FILE = path.join(STATE_DIR, "mongod.pid");
const LOG_FILE = path.join(STATE_DIR, "mongod.log");
const BINARY_CACHE = path.join(ROOT, "node_modules", ".cache", "mongodb-memory-server");
const REPL_SET = "rs0";

function resolveMongoTarget() {
  const url = findEnvValue("DATABASE_URL", ROOT)?.value || "mongodb://localhost:27017/guidance";

  if (url.includes("mongodb+srv") || (!url.includes("localhost") && !url.includes("127.0.0.1"))) {
    console.error(
      "DATABASE_URL points at a remote cluster. This helper only manages a local MongoDB.\n" +
        `Current value: ${url.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@")}`
    );
    process.exit(1);
  }

  const parsed = new URL(url.replace("mongodb://", "http://"));
  return {
    host: parsed.hostname || "127.0.0.1",
    port: Number(parsed.port || 27017),
    dbName: (parsed.pathname || "/guidance").replace("/", "") || "guidance",
  };
}

function findMongodBinary() {
  if (!fs.existsSync(BINARY_CACHE)) return null;
  const candidate = fs
    .readdirSync(BINARY_CACHE)
    .filter((name) => name.startsWith("mongod-") && !name.endsWith(".downloading"))
    .sort()
    .pop();

  return candidate ? path.join(BINARY_CACHE, candidate) : null;
}

/** Node's net module gives a precise answer for IPv4 and IPv6 (::1) alike. */
function checkPort(host, port, timeout = 1500) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeout);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

function readPid() {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, "utf8").trim());
    if (!pid) return null;
    process.kill(pid, 0); // throws when the process is gone
    return pid;
  } catch {
    return null;
  }
}

async function ensureReplicaSet(host, port, dbName) {
  const uri = `mongodb://${host}:${port}/${dbName}?directConnection=true`;
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });

  try {
    await client.connect();
    const admin = client.db("admin");

    const hello = await admin.command({ hello: 1 });
    if (hello.setName === REPL_SET && hello.isWritablePrimary) {
      return "already a writable replica set member";
    }

    if (!hello.setName) {
      await admin.command({
        replSetInitiate: {
          _id: REPL_SET,
          members: [{ _id: 0, host: `${host}:${port}` }],
        },
      });
    }

    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      try {
        const status = await admin.command({ hello: 1 });
        if (status.isWritablePrimary) return "primary";
      } catch {
        // still electing
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error("the replica set did not elect a primary in time");
  } finally {
    await client.close().catch(() => {});
  }
}

async function start() {
  const { host, port, dbName } = resolveMongoTarget();

  if (await checkPort(host, port)) {
    console.log(`MongoDB already listening on ${host}:${port} — leaving it untouched.`);
    console.log(`Replica set: ${await ensureReplicaSet(host, port, dbName)}`);
    return;
  }

  const binary = findMongodBinary();
  if (!binary) {
    console.error(
      "No mongod binary found in node_modules/.cache.\n" +
        "Run `npm install` (the mongodb-memory-server postinstall downloads it) and try again."
    );
    process.exit(1);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log(`Starting ${path.basename(binary)} on ${host}:${port} (dbpath: .local-mongo/data) ...`);

  const out = fs.openSync(LOG_FILE, "a");
  const child = spawn(
    binary,
    [
      "--replSet", REPL_SET,
      "--dbpath", DATA_DIR,
      "--port", String(port),
      "--bind_ip", host,
      "--setParameter", "enableTestCommands=1",
    ],
    { detached: true, stdio: ["ignore", out, out] }
  );
  child.unref();

  fs.writeFileSync(PID_FILE, String(child.pid));

  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    if (await checkPort(host, port)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!(await checkPort(host, port))) {
    console.error(`mongod did not start. See ${LOG_FILE}`);
    process.exit(1);
  }

  console.log(`MongoDB is up (pid ${child.pid}). Initialising the replica set ...`);
  console.log(`Replica set: ${await ensureReplicaSet(host, port, dbName)}`);
  console.log(`\nReady. Next steps:\n  npm run seed\n  npm run dev\n  npm run mongo:stop   (when you are done)\n`);
}

function stop() {
  const pid = readPid();

  if (pid) {
    try {
      process.kill(pid);
      console.log(`Stopped local MongoDB (pid ${pid}).`);
    } catch (error) {
      console.error(`Could not stop pid ${pid}: ${error.message}`);
    }
  } else {
    console.log("No local MongoDB started by this helper is running.");
  }

  fs.rmSync(PID_FILE, { force: true });
}

async function status() {
  const { host, port } = resolveMongoTarget();
  const listening = await checkPort(host, port);
  console.log(`${host}:${port} -> ${listening ? "LISTENING" : "not reachable"}`);

  if (listening) {
    try {
      console.log(`Replica set: ${await ensureReplicaSet(host, port, "admin")}`);
    } catch (error) {
      console.log(`Replica set check failed: ${error.message}`);
    }
  }
}

const command = process.argv[2] || "status";

const actions = { start, stop, status };

if (!actions[command]) {
  console.error("Usage: node scripts/local-mongo.mjs start|stop|status");
  process.exit(1);
}

actions[command]().catch((error) => {
  console.error(error);
  process.exit(1);
});
