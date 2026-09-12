"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { LoadingState, EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { apiRequest, useAsyncSubmit } from "@/lib/client-api";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_VARIANTS,
} from "@/lib/support";
import { formatDateTime } from "@/lib/utils";
import { LifeBuoy, Plus, Send, Loader2, MessageSquare, RefreshCw } from "lucide-react";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const STATUS_FILTERS = [
  { value: "", label: "همه تیکت‌ها" },
  { value: TICKET_STATUS.OPEN, label: "باز" },
  { value: TICKET_STATUS.IN_PROGRESS, label: "در حال بررسی" },
  { value: TICKET_STATUS.CLOSED, label: "بسته شده" },
];

function StatusBadge({ status }) {
  return (
    <Badge variant={TICKET_STATUS_VARIANTS[status] || "secondary"}>
      {TICKET_STATUS_LABELS[status] || "نامشخص"}
    </Badge>
  );
}

/**
 * Support ticket centre.
 *
 * The same component serves students, counselors and administrators: the panel
 * only decides which endpoint data comes from (ownership is enforced on the
 * server) and whether the status controls are rendered. The server also returns
 * `canReply` / `canChangeStatus` per ticket, and those flags are what drive the
 * UI — the client never grants itself permission.
 */
export function TicketCenter({ isAdmin = false, defaultOpen = false }) {
  const { addToast } = useToast();

  const [tickets, setTickets] = React.useState([]);
  const [statusFilter, setStatusFilter] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");

  const [activeTicket, setActiveTicket] = React.useState(null);
  const [replies, setReplies] = React.useState([]);
  const [threadLoading, setThreadLoading] = React.useState(false);
  const [threadError, setThreadError] = React.useState("");
  const [replyBody, setReplyBody] = React.useState("");

  const [createOpen, setCreateOpen] = React.useState(defaultOpen);
  const [newTicket, setNewTicket] = React.useState({
    subject: "",
    body: "",
    category: "OTHER",
    priority: "NORMAL",
  });

  const fetchTickets = React.useCallback(
    (status = statusFilter) => {
      const query = status ? `?status=${status}` : "";

      return apiRequest(`/api/support/tickets${query}`)
        .then((response) => {
          if (!response.ok) {
            setLoadError(
              response.data?.error || "دریافت تیکت‌های پشتیبانی با خطا مواجه شد."
            );
            return;
          }
          setTickets(response.data?.tickets || []);
          setLoadError("");
        })
        .catch(() => setLoadError("دریافت تیکت‌های پشتیبانی با خطا مواجه شد."))
        .finally(() => setLoading(false));
    },
    [statusFilter]
  );

  React.useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const openTicket = React.useCallback(async (ticketId) => {
    setThreadLoading(true);
    setThreadError("");
    setReplies([]);
    setReplyBody("");
    setActiveTicket({ id: ticketId, subject: "", status: "" });

    const response = await apiRequest(`/api/support/tickets/${ticketId}`);

    if (!response.ok) {
      setThreadError(response.data?.error || "دریافت گفت‌وگو با خطا مواجه شد.");
      setThreadLoading(false);
      return;
    }

    setActiveTicket(response.data.ticket);
    setReplies(response.data.replies || []);
    setThreadLoading(false);
  }, []);

  const { loading: creating, run: createTicket } = useAsyncSubmit(async (event) => {
    event.preventDefault();

    const response = await apiRequest("/api/support/tickets", {
      method: "POST",
      body: newTicket,
    });

    if (!response.ok) {
      addToast({
        title: "ثبت تیکت ناموفق بود",
        description: response.data?.error || "اطلاعات وارد‌شده را بررسی کنید.",
        variant: "error",
      });
      return;
    }

    addToast({
      title: "تیکت ثبت شد",
      description: "پشتیبانی در اسرع وقت به پیام شما پاسخ می‌دهد.",
      variant: "success",
    });
    setNewTicket({ subject: "", body: "", category: "OTHER", priority: "NORMAL" });
    setCreateOpen(false);
    setStatusFilter("");
    fetchTickets("");
  });

  const { loading: sending, run: sendReply } = useAsyncSubmit(async (event) => {
    event.preventDefault();
    if (!replyBody.trim() || !activeTicket) return;

    const response = await apiRequest(`/api/support/tickets/${activeTicket.id}`, {
      method: "PATCH",
      body: { body: replyBody.trim() },
    });

    if (!response.ok) {
      addToast({
        title: "ارسال پیام ناموفق بود",
        description: response.data?.error || "لطفاً دوباره تلاش کنید.",
        variant: "error",
      });
      return;
    }

    // A message body is unique per keystroke, so the dedupe cache would not
    // swallow the next message; still, refresh from the server rather than
    // guessing the resulting thread.
    setReplyBody("");
    await openTicket(activeTicket.id);
    fetchTickets();
  });

  const { run: changeStatus } = useAsyncSubmit(async (status) => {
    if (!activeTicket) return;

    const response = await apiRequest(`/api/support/tickets/${activeTicket.id}`, {
      method: "PATCH",
      body: { status },
    });

    if (!response.ok) {
      addToast({
        title: "تغییر وضعیت ناموفق بود",
        description: response.data?.error || "لطفاً دوباره تلاش کنید.",
        variant: "error",
      });
      return;
    }

    addToast({
      title: "وضعیت تیکت به‌روزرسانی شد",
      description: `وضعیت جدید: ${TICKET_STATUS_LABELS[status]}`,
      variant: "success",
    });
    setActiveTicket(response.data.ticket);
    fetchTickets();
  });

  const openCount = tickets.filter((ticket) => ticket.status !== TICKET_STATUS.CLOSED).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LifeBuoy}
        title={isAdmin ? "پشتیبانی کاربران" : "پشتیبانی"}
        description={
          isAdmin
            ? "تیکت‌های ثبت‌شده توسط دانش‌آموزان و مشاوران را بررسی و پاسخ دهید."
            : "مشکل یا سؤال خود را ثبت کنید؛ کارشناسان پشتیبانی به شما پاسخ می‌دهند."
        }
        actions={
          <>
            {!isAdmin && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                ثبت تیکت جدید
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => fetchTickets()}
              aria-label="به‌روزرسانی فهرست تیکت‌ها"
            >
              <RefreshCw className="h-4 w-4" />
              به‌روزرسانی
            </Button>
          </>
        }
      />

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Button
              key={filter.value || "all"}
              variant={statusFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter(filter.value);
                setLoading(true);
                fetchTickets(filter.value);
              }}
            >
              {filter.label}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground">
            {openCount} تیکت باز در این فهرست
          </span>
        </div>
      )}

      {loading ? (
        <LoadingState variant="cards" rows={3} />
      ) : loadError ? (
        <ErrorState description={loadError} onRetry={() => fetchTickets()} />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={isAdmin ? "تیکتی ثبت نشده است" : "هنوز تیکتی ثبت نکرده‌اید"}
          description={
            isAdmin
              ? "به‌محض ثبت تیکت توسط کاربران، در این بخش نمایش داده می‌شود."
              : "اگر با مشکلی مواجه شدید، از دکمه «ثبت تیکت جدید» استفاده کنید."
          }
          action={
            !isAdmin ? (
              <Button className="mt-1" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                ثبت تیکت جدید
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={ticket.status} />
                    <span className="font-medium">{ticket.subject}</span>
                    {ticket.priority === "HIGH" && (
                      <Badge variant="destructive">فوری</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {TICKET_CATEGORY_LABELS[ticket.category] || "سایر"} ·{" "}
                    {TICKET_PRIORITY_LABELS[ticket.priority] || "معمولی"} · آخرین
                    به‌روزرسانی {formatDateTime(ticket.updatedAt)}
                    {isAdmin && ticket.user
                      ? ` · ثبت‌کننده: ${ticket.user.firstName} ${ticket.user.lastName}`
                      : ""}
                  </p>
                </div>

                <Button variant="outline" size="sm" onClick={() => openTicket(ticket.id)}>
                  <MessageSquare className="h-4 w-4" />
                  مشاهده گفت‌وگو
                  {ticket._count?.replies ? ` (${ticket._count.replies})` : ""}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* --- New ticket dialog (users only) --- */}
      {!isAdmin && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>ثبت تیکت پشتیبانی</DialogTitle>
              <DialogDescription>
                مشکل یا سؤال خود را دقیق توضیح دهید تا سریع‌تر بررسی شود.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={createTicket} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticket-subject">عنوان</Label>
                <Input
                  id="ticket-subject"
                  value={newTicket.subject}
                  onChange={(event) =>
                    setNewTicket((previous) => ({ ...previous, subject: event.target.value }))
                  }
                  disabled={creating}
                  placeholder="مثال: نمره درس ریاضی ثبت نشده است"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ticket-category">دسته‌بندی</Label>
                  <select
                    id="ticket-category"
                    className={selectClass}
                    value={newTicket.category}
                    onChange={(event) =>
                      setNewTicket((previous) => ({ ...previous, category: event.target.value }))
                    }
                    disabled={creating}
                  >
                    {Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ticket-priority">اولویت</Label>
                  <select
                    id="ticket-priority"
                    className={selectClass}
                    value={newTicket.priority}
                    onChange={(event) =>
                      setNewTicket((previous) => ({ ...previous, priority: event.target.value }))
                    }
                    disabled={creating}
                  >
                    {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-body">متن پیام</Label>
                <Textarea
                  id="ticket-body"
                  value={newTicket.body}
                  onChange={(event) =>
                    setNewTicket((previous) => ({ ...previous, body: event.target.value }))
                  }
                  disabled={creating}
                  placeholder="توضیح کامل مشکل، همراه با جزئیاتی که به بررسی کمک می‌کند."
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                >
                  انصراف
                </Button>
                <Button
                  type="submit"
                  disabled={creating || newTicket.subject.trim().length < 3 || newTicket.body.trim().length < 10}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      در حال ارسال...
                    </>
                  ) : (
                    "ثبت تیکت"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* --- Thread dialog --- */}
      <Dialog
        open={Boolean(activeTicket)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveTicket(null);
            setReplies([]);
            setThreadError("");
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {activeTicket?.subject || "گفت‌وگوی تیکت"}
              {activeTicket?.status && <StatusBadge status={activeTicket.status} />}
            </DialogTitle>
            <DialogDescription>
              {activeTicket?.category
                ? `${TICKET_CATEGORY_LABELS[activeTicket.category] || "سایر"} · آخرین به‌روزرسانی ${formatDateTime(activeTicket.updatedAt)}`
                : "پیام‌های این تیکت"}
            </DialogDescription>
          </DialogHeader>

          {isAdmin && activeTicket?.canChangeStatus && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3">
              <span className="text-sm font-medium">تغییر وضعیت:</span>
              {Object.values(TICKET_STATUS).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={activeTicket.status === status ? "default" : "outline"}
                  disabled={activeTicket.status === status}
                  onClick={() => changeStatus(status)}
                >
                  {TICKET_STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
          )}

          {threadError ? (
            <ErrorState
              description={threadError}
              onRetry={() => activeTicket && openTicket(activeTicket.id)}
            />
          ) : threadLoading ? (
            <div className="space-y-3">
              {[1, 2].map((index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {replies.map((reply) => (
                <div
                  key={reply.id}
                  className={
                    reply.isStaff
                      ? "rounded-2xl border border-primary/20 bg-primary/5 p-4"
                      : "rounded-2xl border bg-muted/30 p-4"
                  }
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {reply.user
                        ? `${reply.user.firstName} ${reply.user.lastName}`
                        : "کاربر"}
                      {reply.isStaff && <Badge variant="secondary">پشتیبانی</Badge>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(reply.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-7">{reply.body}</p>
                </div>
              ))}
            </div>
          )}

          {activeTicket?.canReply && !threadLoading && (
            <form onSubmit={sendReply} className="space-y-3">
              <Label htmlFor="ticket-reply">پیام جدید</Label>
              <Textarea
                id="ticket-reply"
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                disabled={sending}
                placeholder="پیام خود را بنویسید..."
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={sending || replyBody.trim().length < 2}>
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      در حال ارسال...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      ارسال پیام
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {activeTicket && !activeTicket.canReply && !threadLoading && !isAdmin && (
            <p className="rounded-xl border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
              این تیکت بسته شده است. برای پیگیری موضوع، تیکت جدیدی ثبت کنید.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
