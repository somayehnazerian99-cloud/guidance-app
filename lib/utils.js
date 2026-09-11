import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num) {
  return new Intl.NumberFormat("fa-IR").format(num);
}

export function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("fa-IR");
}

export function formatDateTime(date) {
  if (!date) return "";
  return new Date(date).toLocaleString("fa-IR");
}

export function getInitials(firstName, lastName) {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`;
}

export function truncate(str, length = 50) {
  if (!str) return "";
  return str.length > length ? str.slice(0, length) + "..." : str;
}
