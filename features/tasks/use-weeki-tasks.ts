"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSeedTasks } from "./seed";
import type { Task, TaskDraft } from "./types";

const STORAGE_KEY = "weeki.tasks.v1";

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function useWeekiTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => createSeedTasks());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setTasks(JSON.parse(saved) as Task[]);
    } catch {
      // The starter data remains available if storage is blocked.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [hydrated, tasks]);

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

  const resizeTask = useCallback((id: string, estimateMinutes: number) => {
    setTasks((current) => current.map((task) => {
      if (task.id !== id) return task;
      const now = new Date().toISOString();
      return {
        ...task,
        estimateMinutes,
        updatedAt: now,
        activity: [
          { id: makeId(), text: "Duração ajustada", createdAt: now },
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

  return { tasks: activeTasks, addTask, updateTask, moveTask, resizeTask, toggleComplete, duplicateTask, archiveTask };
}
