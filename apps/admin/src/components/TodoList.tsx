"use client";

import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { CalendarIcon, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "./ui/calendar";

interface AdminTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

const DEFAULT_OPERATIONAL_TASKS: AdminTask[] = [
  {
    id: "task-1",
    text: "Review pending seller verification applications",
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "task-2",
    text: "Inspect low-stock inventory and reorder alerts",
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "task-3",
    text: "Verify carrier delivery webhook synchronization",
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "task-4",
    text: "Audit Kafka DLQ for unhandled poison-pill events",
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "task-5",
    text: "Check fraud risk anomaly flags in high-value orders",
    completed: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const STORAGE_KEY = "larekmart_admin_operational_tasks";

const TodoList = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<AdminTask[]>(DEFAULT_OPERATIONAL_TASKS);
  const [newTaskText, setNewTaskText] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persisted tasks from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTasks(parsed);
        }
      }
    } catch {
      // Fallback to default
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save to localStorage upon mutation
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch {
        // Ignore quota errors
      }
    }
  }, [tasks, isLoaded]);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTask: AdminTask = {
      id: `task-${Date.now()}`,
      text: newTaskText.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) => [newTask, ...prev]);
    setNewTaskText("");
  };

  const deleteTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-medium">Daily Operations Checklist</h1>
        <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          {completedCount} / {tasks.length} done
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              suppressHydrationWarning
              className="flex-1 justify-start text-left font-normal text-xs h-9"
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              {date ? format(date, "PPP") : <span>Pick date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-auto">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(selectedDate) => {
                setDate(selectedDate);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* ADD TASK INPUT */}
      <form onSubmit={handleAddTask} className="flex items-center gap-2 mb-3">
        <Input
          type="text"
          placeholder="Add operational task..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          className="text-xs h-8"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!newTaskText.trim()}
          className="h-8 px-2.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add
        </Button>
      </form>

      {/* LIST */}
      <ScrollArea className="max-h-[340px] overflow-y-auto pr-1">
        <div className="flex flex-col gap-2">
          {tasks.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-6">
              All tasks completed! Add a new operational task above.
            </p>
          ) : (
            tasks.map((task) => (
              <Card
                key={task.id}
                className={`p-3 transition-colors cursor-pointer group flex items-center justify-between gap-2 ${
                  task.completed
                    ? "bg-muted/40 opacity-70"
                    : "hover:bg-muted/30"
                }`}
                onClick={() => toggleTask(task.id)}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Checkbox
                    id={task.id}
                    checked={task.completed}
                    onCheckedChange={() => toggleTask(task.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <label
                    htmlFor={task.id}
                    className={`text-xs cursor-pointer select-none leading-relaxed truncate ${
                      task.completed
                        ? "line-through text-muted-foreground"
                        : "text-foreground font-medium"
                    }`}
                  >
                    {task.text}
                  </label>
                </div>
                <button
                  type="button"
                  onClick={(e) => deleteTask(task.id, e)}
                  title="Delete task"
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-1 rounded cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TodoList;
