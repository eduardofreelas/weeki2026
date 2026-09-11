"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSeedTasks } from "./seed";
import type { Task, TaskDraft, TaskPriority, TaskStatus } from "./types";
import type { ReportActivityCategory } from "@/shared/reports";

const STORAGE_KEY = "weeki.tasks.v1";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const reportCategories = new Set<ReportActivityCategory>([
  "design",
  "development",
  "social_media",
  "support",
  "consulting",
  "maintenance",
  "engineering",
  "architecture",
  "photography",
  "administrative",
  "other",
]);

type StoredTask = Omit<Task, "report"> & { report?: Partial<Task["report"]> };

function normalizeTask(task: StoredTask): Task {
  const category = task.report?.category;
  return {
    ...task,
    report: {
      includeInReports: task.report?.includeInReports ?? Boolean(task.clientId),
      description: task.report?.description ?? "",
      category: category && reportCategories.has(category) ? category : "other",
      evidenceNotes: task.report?.evidenceNotes ?? "",
    },
  };
}

export function useWeekiTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window === "undefined") return createSeedTasks().map(normalizeTask);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const loaded = saved ? JSON.parse(saved) as StoredTask[] : createSeedTasks();
      return loaded.map(normalizeTask);
    } catch {
      return createSeedTasks().map(normalizeTask);
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // The app remains usable when browser storage is unavailable.
    }
  }, [tasks]);

  const addTask = useCallback((draft: TaskDraft) => {
    const now = new Date().toISOString();
    const task: Task = {
      ...draft,
      id: makeId(),
      createdAt: now,
      updatedAt: now,
      activity: [{ id: makeId(), text: "Demanda criada", createdAt: now }],
    };
    setTasks((current) => [task, ...current]);
    return task;
  }, []);

  const updateTask = useCallback((id: string, draft: TaskDraft, recordActivity = true) => {
    setTasks((current) => current.map((task) => {
      if (task.id !== id) return task;
      const now = new Date().toISOString();
      return {
        ...task,
        ...draft,
        updatedAt: now,
        activity: recordActivity
          ? [{ id: makeId(), text: "Detalhes atualizados", createdAt: now }, ...task.activity]
          : task.activity,
      };
    }));
  }, []);

  const moveTask = useCallback((id: string, scheduledDate: string | null, scheduledTime?: string) => {
    setTasks((current) => current.map((task) => {
      if (task.id !== id) return task;
      const now = new Date().toISOString();
      return {
        ...task,
        scheduledDate,
        scheduledTime: scheduledTime ?? task.scheduledTime,
        updatedAt: now,
        activity: [
          {
            id: makeId(),
            text: scheduledDate ? "Movida para outro dia" : "Movida para a Caixa de Entrada",
            createdAt: now,
          },
          ...task.activity,
        ],
      };
    }));
  }, []);

  const assignTaskClient = useCallback((id: string, clientId: string | null) => {
    setTasks((current) => current.map((task) => {
      if (task.id !== id) return task;
      const now = new Date().toISOString();
      return {
        ...task,
        clientId,
        updatedAt: now,
        activity: [
          { id: makeId(), text: clientId ? "Movida para outro cliente" : "Removida do cliente", createdAt: now },
          ...task.activity,
        ],
      };
    }));
  }, []);

  const setTaskStatus = useCallback((id: string, status: TaskStatus) => {
    setTasks((current) => current.map((task) => {
      if (task.id !== id || task.status === status) return task;
      const now = new Date().toISOString();
      return {
        ...task,
        status,
        updatedAt: now,
        activity: [
          { id: makeId(), text: `Status alterado para ${status}`, createdAt: now },
          ...task.activity,
        ],
      };
    }));
  }, []);

  const setTaskPriority = useCallback((id: string, priority: TaskPriority) => {
    setTasks((current) => current.map((task) => {
      if (task.id !== id || task.priority === priority) return task;
      const now = new Date().toISOString();
      return {
        ...task,
        priority,
        updatedAt: now,
        activity: [
          { id: makeId(), text: "Prioridade atualizada", createdAt: now },
          ...task.activity,
        ],
      };
    }));
  }, []);

  const toggleComplete = useCallback((id: string) => {
    setTasks((current) => current.map((task) => {
      if (task.id !== id) return task;
      const completed = task.status === "completed";
      const now = new Date().toISOString();
      return {
        ...task,
        status: completed ? "not_started" : "completed",
        updatedAt: now,
        activity: [
          { id: makeId(), text: completed ? "Demanda reaberta" : "Demanda concluída", createdAt: now },
          ...task.activity,
        ],
      };
    }));
  }, []);

  const duplicateTask = useCallback((id: string) => {
    setTasks((current) => {
      const source = current.find((task) => task.id === id);
      if (!source) return current;
      const now = new Date().toISOString();
      const copy: Task = {
        ...source,
        id: makeId(),
        title: `${source.title} — cópia`,
        status: "not_started",
        createdAt: now,
        updatedAt: now,
        activity: [{ id: makeId(), text: "Demanda duplicada", createdAt: now }],
      };
      return [copy, ...current];
    });
  }, []);

  const archiveTask = useCallback((id: string) => {
    const now = new Date().toISOString();
    setTasks((current) => current.map((task) =>
      task.id === id ? { ...task, archivedAt: now, updatedAt: now } : task,
    ));
  }, []);

  const activeTasks = useMemo(() => tasks.filter((task) => !task.archivedAt), [tasks]);

  return { tasks: activeTasks, addTask, updateTask, moveTask, assignTaskClient, setTaskStatus, setTaskPriority, toggleComplete, duplicateTask, archiveTask };
}
