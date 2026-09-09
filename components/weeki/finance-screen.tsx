"use client";

import { useMemo, useState } from "react";
import { endOfMonth, format, isAfter, isBefore, isSameMonth, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowUpRightIcon,
  BanknoteArrowDown,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Client } from "@/features/clients/types";
import {
  EXPENSE_CATEGORIES,
  FINANCE_STATUS_LABELS,
  INCOME_CATEGORIES,
  PAYMENT_METHOD_LABELS,
  type FinanceTransaction,
  type FinanceTransactionDraft,
  type FinanceTransactionStatus,
  type FinanceTransactionType,
} from "@/features/finance/types";
import { useWeekiFinance } from "@/features/finance/use-weeki-finance";
import { cn } from "@/lib/utils";
import { FinanceTransactionDialog } from "./finance-transaction-dialog";

type FinanceView = "overview" | "transactions";
type TransactionTab = "all" | "income" | "expense" | "pending";
type PeriodFilter = "month" | "quarter" | "all";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const preciseCurrency = currency;

const transactionTime = (transaction: FinanceTransaction) => parseISO(transaction.dueDate).getTime();
const sumTransactions = (transactions: FinanceTransaction[], type: FinanceTransactionType, statuses?: FinanceTransactionStatus[]) => transactions
  .filter((transaction) => transaction.type === type && (!statuses || statuses.includes(transaction.status)))
  .reduce((total, transaction) => total + transaction.amount, 0);

export function FinanceScreen({ clients }: { clients: Client[] }) {
  const { transactions, addTransaction, updateTransaction, setTransactionStatus, duplicateTransaction } = useWeekiFinance();
  const [view, setView] = useState<FinanceView>("overview");
  const [rangeMonths, setRangeMonths] = useState("6");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialType, setInitialType] = useState<FinanceTransactionType>("income");
  const [selectedTransaction, setSelectedTransaction] = useState<FinanceTransaction | null>(null);

  const openCreate = (type: FinanceTransactionType) => {
    setSelectedTransaction(null);
    setInitialType(type);
    setDialogOpen(true);
  };

  const openEdit = (transaction: FinanceTransaction) => {
    setSelectedTransaction(transaction);
    setInitialType(transaction.type);
    setDialogOpen(true);
  };

  const saveTransaction = (draft: FinanceTransactionDraft, id?: string) => {
    if (id) {
      updateTransaction(id, draft);
      toast.success("Transação atualizada.");
    } else {
      addTransaction(draft);
      toast.success(draft.type === "income" ? "Receita registrada." : "Despesa registrada.");
    }
  };

  const markAsPaid = (transaction: FinanceTransaction) => {
    setTransactionStatus(transaction.id, "paid");
    toast.success(transaction.type === "income" ? "Recebimento confirmado." : "Pagamento confirmado.");
  };

  const duplicate = (transaction: FinanceTransaction) => {
    duplicateTransaction(transaction.id);
    toast.success("Transação duplicada como pendente.");
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5"><span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground"><WalletCards className="size-4" /></span><h1 className="text-2xl font-semibold tracking-tight text-slate-900">Financeiro</h1></div>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">Receitas, despesas e previsões para decidir com mais clareza.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === "overview" && <Select value={rangeMonths} onValueChange={setRangeMonths}><SelectTrigger className="h-8 w-[142px] rounded-md bg-white text-[11px] shadow-none"><CalendarRange className="size-3.5" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="3">Últimos 3 meses</SelectItem><SelectItem value="6">Últimos 6 meses</SelectItem><SelectItem value="12">Últimos 12 meses</SelectItem></SelectContent></Select>}
          <Button type="button" variant="outline" size="sm" onClick={() => openCreate("expense")} className="h-8 rounded-md border-rose-200 bg-white px-2.5 text-[11px] text-rose-600 shadow-none hover:bg-rose-50"><ArrowUpRight className="size-3.5" /> Nova despesa</Button>
          <Button type="button" size="sm" onClick={() => openCreate("income")}><Plus className="size-3.5" /> Nova receita</Button>
        </div>
      </div>

      <nav className="mt-6 flex border-b border-slate-200" aria-label="Seções do financeiro">
        {([{ value: "overview", label: "Visão geral" }, { value: "transactions", label: "Transações" }] as const).map((item) => (
          <button key={item.value} type="button" onClick={() => setView(item.value)} className={cn("flex h-10 items-center border-b-2 border-transparent px-1 text-sm font-medium text-slate-500 transition [&+button]:ml-8", view === item.value && "border-foreground font-semibold text-foreground")}>{item.label}{item.value === "transactions" && <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{transactions.length}</span>}</button>
        ))}
      </nav>

      {view === "overview" ? (
        <FinanceOverview transactions={transactions} clients={clients} rangeMonths={Number(rangeMonths)} onOpenTransactions={() => setView("transactions")} onOpenTransaction={openEdit} onNewIncome={() => openCreate("income")} />
      ) : (
        <TransactionsView transactions={transactions} clients={clients} onEdit={openEdit} onMarkAsPaid={markAsPaid} onDuplicate={duplicate} onNew={() => openCreate("income")} />
      )}

      <FinanceTransactionDialog key={`${dialogOpen ? "open" : "closed"}-${selectedTransaction?.id ?? "new"}-${initialType}`} open={dialogOpen} onOpenChange={setDialogOpen} initialType={initialType} transaction={selectedTransaction} clients={clients} onSave={saveTransaction} />
    </div>
  );
}

function FinanceOverview({ transactions, clients, rangeMonths, onOpenTransactions, onOpenTransaction, onNewIncome }: { transactions: FinanceTransaction[]; clients: Client[]; rangeMonths: number; onOpenTransactions: () => void; onOpenTransaction: (transaction: FinanceTransaction) => void; onNewIncome: () => void }) {
  const now = new Date();
  const current = transactions.filter((transaction) => isSameMonth(parseISO(transaction.dueDate), now));
  const previousDate = subMonths(now, 1);
  const previous = transactions.filter((transaction) => isSameMonth(parseISO(transaction.dueDate), previousDate));
  const currentIncome = sumTransactions(current, "income", ["paid"]);
  const currentExpenses = sumTransactions(current, "expense", ["paid"]);
  const previousIncome = sumTransactions(previous, "income", ["paid"]);
  const previousExpenses = sumTransactions(previous, "expense", ["paid"]);
  const receivable = sumTransactions(current, "income", ["pending", "overdue"]);
  const profit = currentIncome - currentExpenses;
  const previousProfit = previousIncome - previousExpenses;
  const recurringIncome = transactions.filter((transaction) => transaction.type === "income" && transaction.recurring && (!transaction.recurrenceEndDate || transaction.recurrenceEndDate >= format(now, "yyyy-MM-dd")));

  const chartData = Array.from({ length: rangeMonths }, (_, index) => {
    const month = subMonths(startOfMonth(now), rangeMonths - index - 1);
    const monthTransactions = transactions.filter((transaction) => isSameMonth(parseISO(transaction.dueDate), month));
    return {
      month: format(month, "MMM", { locale: ptBR }).replace(".", ""),
      receita: sumTransactions(monthTransactions, "income"),
      despesas: sumTransactions(monthTransactions, "expense"),
    };
  });

  const recent = [...transactions].sort((a, b) => transactionTime(b) - transactionTime(a)).slice(0, 6);

  return (
    <>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Receita do mês" value={currentIncome} previousValue={previousIncome} tone="emerald" icon={TrendingUp} />
        <MetricCard label="Despesas" value={currentExpenses} previousValue={previousExpenses} inverse tone="rose" icon={TrendingDown} />
        <MetricCard label="Lucro líquido" value={profit} previousValue={previousProfit} tone="violet" icon={WalletCards} />
        <MetricCard label="A receber" value={receivable} detail={`${current.filter((item) => item.type === "income" && item.status !== "paid").length} lançamentos pendentes`} tone="amber" icon={BanknoteArrowDown} />
      </section>

      <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
        <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-slate-900">Receita vs. despesas</h2><p className="mt-1 text-[11px] text-slate-400">Movimentações previstas por mês.</p></div><div className="flex items-center gap-3 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#6251e5]" />Receita</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#f08aa5]" />Despesas</span></div></div>
          <div className="mt-5 h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <defs><linearGradient id="finance-income-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6251e5" stopOpacity={0.2} /><stop offset="95%" stopColor="#6251e5" stopOpacity={0} /></linearGradient><linearGradient id="finance-expense-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e76d8f" stopOpacity={0.14} /><stop offset="95%" stopColor="#e76d8f" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#eef1f5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8" }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <Tooltip cursor={{ stroke: "#dfe3ea", strokeDasharray: "3 3" }} contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "none", fontSize: 11 }} formatter={(value, name) => [preciseCurrency.format(Number(value)), name === "receita" ? "Receita" : "Despesas"]} />
                <Area type="monotone" dataKey="receita" stroke="#6251e5" strokeWidth={2.2} fill="url(#finance-income-gradient)" activeDot={{ r: 4, fill: "#6251e5" }} />
                <Area type="monotone" dataKey="despesas" stroke="#e76d8f" strokeWidth={2} fill="url(#finance-expense-gradient)" activeDot={{ r: 4, fill: "#e76d8f" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold text-slate-900">Previsão do mês</h2><p className="mt-1 text-[11px] text-slate-400">Receita confirmada e a receber.</p></div><span className="grid size-8 place-items-center rounded-md bg-[#f0edff] text-[#5d47df]"><Sparkles className="size-4" /></span></div>
          <div className="mt-6"><p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">Total previsto</p><p className="mt-1 text-[28px] font-bold tracking-[-0.045em] text-slate-900">{currency.format(currentIncome + receivable)}</p></div>
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4"><ForecastRow label="Já recebido" value={currentIncome} color="bg-emerald-500" /><ForecastRow label="A receber" value={receivable} color="bg-amber-400" /><ForecastRow label="Despesas pagas" value={currentExpenses} color="bg-rose-400" /></div>
          <div className="mt-5 rounded-lg bg-slate-50 p-3"><div className="flex items-center justify-between text-[10px] text-slate-500"><span>Margem após despesas</span><span className="font-semibold text-slate-700">{currentIncome ? Math.round((profit / currentIncome) * 100) : 0}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-[#6954e8] to-[#21b6a8]" style={{ width: `${Math.max(0, Math.min(100, currentIncome ? (profit / currentIncome) * 100 : 0))}%` }} /></div></div>
        </article>
      </section>

      <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(310px,0.8fr)]">
        <article className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-900">Receitas recorrentes</h2><p className="mt-1 text-[11px] text-slate-400">Entradas previstas para os próximos ciclos.</p></div><Button type="button" variant="ghost" size="sm" onClick={onNewIncome} className="h-7 rounded-md px-2 text-[10px] text-[#5b45dc]"><Plus className="size-3" /> Adicionar</Button></div>
          <div className="mt-4 divide-y divide-slate-100">
            {recurringIncome.length ? recurringIncome.map((transaction) => { const client = clients.find((item) => item.id === transaction.clientId); return <button key={transaction.id} type="button" onClick={() => onOpenTransaction(transaction)} className="flex w-full items-center gap-3 py-3 text-left"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-600"><RefreshCw className="size-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-800">{transaction.description}</span><span className="mt-0.5 block truncate text-[10px] text-slate-400">{client?.name ?? "Receita sem cliente"} • {transaction.recurrence === "monthly" ? "Mensal" : transaction.recurrence === "weekly" ? "Semanal" : "Anual"}</span></span><span className="text-xs font-semibold tabular-nums text-emerald-700">{preciseCurrency.format(transaction.amount)}</span></button>; }) : <EmptyFinance title="Nenhuma receita recorrente" description="Cadastre contratos e mensalidades para visualizar sua previsibilidade." />}
          </div>
          {recurringIncome.length > 0 && <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-[11px]"><span className="text-slate-500">Receita recorrente mensal</span><span className="font-semibold tabular-nums text-slate-900">{preciseCurrency.format(recurringIncome.reduce((total, item) => total + (item.recurrence === "monthly" ? item.amount : 0), 0))}</span></div>}
        </article>

        <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-[#17171d] p-5 text-white">
          <div className="flex items-start justify-between"><span className="grid size-9 place-items-center rounded-lg bg-white/10 text-[#ab9cff]"><Landmark className="size-[18px]" /></span><span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-white/55">Integração futura</span></div>
          <h2 className="mt-6 text-base font-semibold">Conciliação automática</h2><p className="mt-2 max-w-md text-[11px] leading-5 text-white/55">Quando a integração de cobranças estiver ativa, pagamentos confirmados poderão dar baixa no Financeiro sem trabalho manual.</p>
          <div className="mt-5 flex items-center gap-2"><Button type="button" size="sm" onClick={() => toast.info("A conexão com Asaas ficará disponível no módulo de Cobranças.")} className="h-8 rounded-md bg-white px-3 text-[11px] text-slate-900 shadow-none hover:bg-white/90">Conhecer integração <ArrowUpRightIcon className="size-3.5" /></Button><span className="text-[10px] text-white/35">Asaas</span></div>
        </article>
      </section>

      <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5"><div><h2 className="text-sm font-semibold text-slate-900">Movimentações recentes</h2><p className="mt-0.5 text-[10px] text-slate-400">Últimos lançamentos do fluxo.</p></div><Button type="button" variant="ghost" size="sm" onClick={onOpenTransactions} className="h-7 rounded-md px-2 text-[10px] text-[#5b45dc]">Ver extrato completo</Button></div>
        <TransactionTable transactions={recent} clients={clients} onEdit={onOpenTransaction} compact />
      </section>
    </>
  );
}

function TransactionsView({ transactions, clients, onEdit, onMarkAsPaid, onDuplicate, onNew }: { transactions: FinanceTransaction[]; clients: Client[]; onEdit: (transaction: FinanceTransaction) => void; onMarkAsPaid: (transaction: FinanceTransaction) => void; onDuplicate: (transaction: FinanceTransaction) => void; onNew: () => void }) {
  const [tab, setTab] = useState<TransactionTab>("all");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<FinanceTransactionStatus | "all">("all");

  const filtered = useMemo(() => {
    const now = new Date();
    const periodStart = period === "month" ? startOfMonth(now) : period === "quarter" ? subMonths(now, 3) : null;
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return [...transactions].filter((transaction) => {
      const client = clients.find((item) => item.id === transaction.clientId);
      const due = parseISO(transaction.dueDate);
      const matchesTab = tab === "all" || transaction.type === tab || (tab === "pending" && transaction.status !== "paid");
      const matchesSearch = !normalizedQuery || `${transaction.description} ${transaction.partnerName} ${transaction.category} ${client?.name ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
      const matchesPeriod = !periodStart || (!isBefore(due, periodStart) && !isAfter(due, endOfMonth(now)));
      return matchesTab && matchesSearch && matchesPeriod && (clientFilter === "all" || transaction.clientId === clientFilter) && (categoryFilter === "all" || transaction.category === categoryFilter) && (statusFilter === "all" || transaction.status === statusFilter);
    }).sort((a, b) => transactionTime(b) - transactionTime(a));
  }, [transactions, clients, tab, query, period, clientFilter, categoryFilter, statusFilter]);

  const counts = {
    all: transactions.length,
    income: transactions.filter((item) => item.type === "income").length,
    expense: transactions.filter((item) => item.type === "expense").length,
    pending: transactions.filter((item) => item.status !== "paid").length,
  };
  const categories = Array.from(new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]));
  const totalIncome = sumTransactions(filtered, "income");
  const totalExpense = sumTransactions(filtered, "expense");

  const exportCsv = () => {
    const lines = [["Data", "Tipo", "Descrição", "Cliente/Fornecedor", "Categoria", "Status", "Valor"], ...filtered.map((transaction) => {
      const client = clients.find((item) => item.id === transaction.clientId);
      return [transaction.dueDate, transaction.type === "income" ? "Receita" : "Despesa", transaction.description, client?.name ?? transaction.partnerName, transaction.category, FINANCE_STATUS_LABELS[transaction.status], transaction.amount.toFixed(2).replace(".", ",")];
    })];
    const csv = lines.map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `weeki-extrato-${format(new Date(), "yyyy-MM-dd")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Extrato exportado em CSV.");
  };

  return (
    <>
      <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="week-board-scroll flex max-w-full gap-1 overflow-x-auto">
          {([{ value: "all", label: "Todas" }, { value: "income", label: "Receitas" }, { value: "expense", label: "Despesas" }, { value: "pending", label: "Pendentes" }] as const).map((item) => <button key={item.value} type="button" onClick={() => setTab(item.value)} className={cn("h-8 shrink-0 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600", tab === item.value && "border-slate-900 bg-slate-900 text-white")}>{item.label} <span className={cn("ml-1 text-slate-400", tab === item.value && "text-white/55")}>{counts[item.value]}</span></button>)}
        </div>
        <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length} className="h-8 rounded-md bg-white px-2.5 text-[11px] shadow-none"><Download className="size-3.5" /> Exportar CSV</Button><Button type="button" size="sm" onClick={onNew} className="h-8 rounded-md bg-[#5140df] px-3 text-[11px] shadow-none hover:bg-[#4432cf]"><Plus className="size-3.5" /> Nova transação</Button></div>
      </div>

      <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-2 xl:grid-cols-[minmax(210px,1.4fr)_150px_180px_190px_150px]">
        <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no extrato..." className="h-8 rounded-md border-slate-200 pl-8 text-[11px] shadow-none" /></div>
        <Select value={period} onValueChange={(value) => setPeriod(value as PeriodFilter)}><SelectTrigger className="h-8 rounded-md text-[11px] shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todo o período</SelectItem><SelectItem value="month">Mês atual</SelectItem><SelectItem value="quarter">Últimos 3 meses</SelectItem></SelectContent></Select>
        <Select value={clientFilter} onValueChange={setClientFilter}><SelectTrigger className="h-8 rounded-md text-[11px] shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Clientes e parceiros</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="h-8 rounded-md text-[11px] shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FinanceTransactionStatus | "all")}><SelectTrigger className="h-8 rounded-md text-[11px] shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(FINANCE_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
      </div>

      <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <TransactionTable transactions={filtered} clients={clients} onEdit={onEdit} onMarkAsPaid={onMarkAsPaid} onDuplicate={onDuplicate} />
        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-[10px] text-slate-500 sm:flex-row sm:items-center"><span>{filtered.length} transações encontradas</span><div className="flex items-center gap-4 sm:ml-auto"><span>Receitas <strong className="font-semibold text-emerald-700">{preciseCurrency.format(totalIncome)}</strong></span><span>Despesas <strong className="font-semibold text-rose-600">{preciseCurrency.format(totalExpense)}</strong></span><span>Saldo <strong className="font-semibold text-slate-900">{preciseCurrency.format(totalIncome - totalExpense)}</strong></span></div><div className="flex items-center gap-1 sm:ml-3"><button className="grid size-6 place-items-center rounded border bg-white text-slate-400" aria-label="Página anterior"><ChevronLeft className="size-3" /></button><span className="grid size-6 place-items-center rounded bg-slate-900 text-white">1</span><button className="grid size-6 place-items-center rounded border bg-white text-slate-400" aria-label="Próxima página"><ChevronRight className="size-3" /></button></div></div>
      </section>
    </>
  );
}

function TransactionTable({ transactions, clients, onEdit, onMarkAsPaid, onDuplicate, compact = false }: { transactions: FinanceTransaction[]; clients: Client[]; onEdit: (transaction: FinanceTransaction) => void; onMarkAsPaid?: (transaction: FinanceTransaction) => void; onDuplicate?: (transaction: FinanceTransaction) => void; compact?: boolean }) {
  if (!transactions.length) return <EmptyFinance title="Nenhuma transação encontrada" description="Ajuste os filtros ou registre uma nova movimentação." />;
  return (
    <>
      <div className="week-board-scroll hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[820px] text-left">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-[9px] font-semibold uppercase tracking-[0.055em] text-slate-400"><tr><th className="px-4 py-3 sm:px-5">Vencimento</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Categoria</th>{!compact && <th className="px-4 py-3">Pagamento</th>}<th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Valor</th><th className="w-12 px-3 py-3" /></tr></thead>
          <tbody className="divide-y divide-slate-100">{transactions.map((transaction) => { const client = clients.find((item) => item.id === transaction.clientId); return <tr key={transaction.id} className="text-[11px] text-slate-600 transition hover:bg-slate-50/60"><td className="px-4 py-3 tabular-nums sm:px-5"><p className="font-medium text-slate-700">{format(parseISO(transaction.dueDate), "dd MMM yyyy", { locale: ptBR })}</p>{transaction.paidDate && <p className="mt-0.5 text-[9px] text-slate-400">Baixa {format(parseISO(transaction.paidDate), "dd/MM")}</p>}</td><td className="px-4 py-3"><div className="flex items-center gap-2.5"><span className={cn("grid size-7 shrink-0 place-items-center rounded-md", transaction.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500")}>{transaction.type === "income" ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}</span><div className="min-w-0"><button type="button" onClick={() => onEdit(transaction)} className="block max-w-[260px] truncate font-semibold text-slate-800 hover:text-[#5b45dc]">{transaction.description}</button><p className="mt-0.5 max-w-[240px] truncate text-[9px] text-slate-400">{client?.name ?? (transaction.partnerName || "Sem cliente ou fornecedor")}</p></div></div></td><td className="px-4 py-3"><span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[9px] text-slate-500">{transaction.category}</span></td>{!compact && <td className="px-4 py-3"><p>{PAYMENT_METHOD_LABELS[transaction.paymentMethod]}</p><p className="mt-0.5 text-[9px] text-slate-400">{transaction.account}</p></td>}<td className="px-4 py-3"><StatusBadge status={transaction.status} /></td><td className={cn("px-4 py-3 text-right font-semibold tabular-nums", transaction.type === "income" ? "text-emerald-700" : "text-rose-600")}>{transaction.type === "expense" ? "− " : "+ "}{preciseCurrency.format(transaction.amount)}</td><td className="px-3 py-3 text-right"><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="grid size-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100"><MoreHorizontal className="size-4" /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onEdit(transaction)}><Pencil /> Editar</DropdownMenuItem>{transaction.status !== "paid" && onMarkAsPaid && <DropdownMenuItem onSelect={() => onMarkAsPaid(transaction)}><Check /> Marcar como pago</DropdownMenuItem>}{onDuplicate && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => onDuplicate(transaction)}><Copy /> Duplicar como pendente</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></td></tr>; })}</tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 sm:hidden">{transactions.map((transaction) => { const client = clients.find((item) => item.id === transaction.clientId); return <button type="button" key={transaction.id} onClick={() => onEdit(transaction)} className="flex w-full items-start gap-3 px-4 py-3 text-left"><span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-md", transaction.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500")}>{transaction.type === "income" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-800">{transaction.description}</span><span className="mt-1 block truncate text-[10px] text-slate-400">{client?.name ?? (transaction.partnerName || transaction.category)}</span><span className="mt-2 flex items-center gap-2"><StatusBadge status={transaction.status} /><span className="text-[9px] text-slate-400">{format(parseISO(transaction.dueDate), "dd MMM", { locale: ptBR })}</span></span></span><span className={cn("mt-1 shrink-0 text-xs font-semibold tabular-nums", transaction.type === "income" ? "text-emerald-700" : "text-rose-600")}>{transaction.type === "expense" ? "− " : "+ "}{currency.format(transaction.amount)}</span></button>; })}</div>
    </>
  );
}

function MetricCard({ label, value, previousValue, inverse = false, detail, tone, icon: Icon }: { label: string; value: number; previousValue?: number; inverse?: boolean; detail?: string; tone: "emerald" | "rose" | "violet" | "amber"; icon: typeof TrendingUp }) {
  const change = previousValue ? ((value - previousValue) / Math.abs(previousValue)) * 100 : 0;
  const positive = inverse ? change <= 0 : change >= 0;
  const tones = { emerald: "bg-emerald-50 text-emerald-600", rose: "bg-rose-50 text-rose-500", violet: "bg-[#f0edff] text-[#5b45dc]", amber: "bg-amber-50 text-amber-600" };
  return <article className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.055em] text-slate-500">{label}</p><span className={cn("grid size-7 place-items-center rounded-md", tones[tone])}><Icon className="size-3.5" /></span></div><p className="mt-4 text-[22px] font-bold tracking-[-0.04em] text-slate-900">{currency.format(value)}</p>{detail ? <p className="mt-1 text-[10px] text-slate-400">{detail}</p> : <p className={cn("mt-1 flex items-center gap-1 text-[10px]", positive ? "text-emerald-600" : "text-rose-500")}>{positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{Math.abs(change).toFixed(1).replace(".", ",")}% <span className="text-slate-400">vs. mês anterior</span></p>}</article>;
}

function ForecastRow({ label, value, color }: { label: string; value: number; color: string }) { return <div className="flex items-center gap-2.5"><span className={cn("size-2 rounded-full", color)} /><span className="flex-1 text-[11px] text-slate-500">{label}</span><span className="text-xs font-semibold tabular-nums text-slate-800">{preciseCurrency.format(value)}</span></div>; }

function StatusBadge({ status }: { status: FinanceTransactionStatus }) {
  return <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[9px] font-medium", status === "paid" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "overdue" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700")}><span className="size-1.5 rounded-full bg-current" />{FINANCE_STATUS_LABELS[status]}</span>;
}

function EmptyFinance({ title, description }: { title: string; description: string }) {
  return <div className="grid min-h-36 place-items-center px-5 py-10 text-center"><div><ReceiptText className="mx-auto size-6 text-slate-300" /><h3 className="mt-3 text-xs font-semibold text-slate-700">{title}</h3><p className="mt-1 text-[10px] text-slate-400">{description}</p></div></div>;
}
