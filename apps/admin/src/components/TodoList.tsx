"use client";

import { useState } from "react";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { CalendarIcon, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "./ui/calendar";

interface AdminTask {
  id: string;
  text: string;
  completed: boolean;
}

const INITIAL_TASKS: AdminTask[] = [
  {
    id: "task-1",
    text: "Review pending seller verification applications",
    completed: true,
  },
  {
    id: "task-2",
    text: "Inspect low-stock inventory and reorder alerts",
    completed: true,
  },
  {
    id: "task-3",
    text: "Verify carrier delivery webhook synchronization",
    completed: false,
  },
  {
    id: "task-4",
    text: "Audit Kafka DLQ for unhandled poison-pill events",
    completed: false,
  },
  {
    id: "task-5",
    text: "Check fraud risk anomaly flags in high-value orders",
    completed: false,
  },
  {
    id: "task-6",
    text: "Reconcile daily escrow settlement ledger",
    completed: true,
  },
  {
    id: "task-7",
    text: "Audit promotional coupon discount redemption budgets",
    completed: false,
  },
  {
    id: "task-8",
    text: "Verify synthetic canary health and gateway latency",
    completed: true,
  },
];

const TodoList = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<AdminTask[]>(INITIAL_TASKS);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal mb-4"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
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

      {/* LIST */}
      <ScrollArea className="max-h-[380px] overflow-y-auto pr-1">
        <div className="flex flex-col gap-2.5">
          {tasks.map((task) => (
            <Card
              key={task.id}
              className={`p-3.5 transition-colors cursor-pointer ${
                task.completed ? "bg-muted/40 opacity-75" : "hover:bg-muted/20"
              }`}
              onClick={() => toggleTask(task.id)}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  id={task.id}
                  checked={task.completed}
                  onCheckedChange={() => toggleTask(task.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <label
                  htmlFor={task.id}
                  className={`text-xs cursor-pointer select-none leading-relaxed ${
                    task.completed
                      ? "line-through text-muted-foreground"
                      : "text-foreground font-medium"
                  }`}
                >
                  {task.text}
                </label>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default TodoList;
