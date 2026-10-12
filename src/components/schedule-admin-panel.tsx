"use client";

import { useTranslations } from "next-intl";
import React, { useState, useMemo } from "react";
import type { TodoItem } from "@/types";
import { useNavelixData } from "@/context/navelix-context";
import { toLocalDateStr } from "@/lib/date-utils";
import ConfirmDialog from "./confirm-dialog";

export default function ScheduleAdminPanel() {
  const tx = useTranslations();
  const { todos: schedules, projects, refreshData } = useNavelixData();
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TodoItem | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formPriority, setFormPriority] = useState<"high" | "medium" | "low">("medium");
  const [formProjectId, setFormProjectId] = useState("");
  const [formNotice, setFormNotice] = useState("");

  // Delete Confirm Dialog State
  const [scheduleToDelete, setScheduleToDelete] = useState<TodoItem | null>(null);

  // Open Modal for Create or Edit
  const handleOpenModal = (item?: TodoItem) => {
    if (item) {
      setEditingSchedule(item);
      setFormTitle(item.title);
      setFormDueDate(item.dueDate || toLocalDateStr());
      setFormPriority(item.priority || "medium");
      setFormProjectId(item.projectId || "");
    } else {
      setEditingSchedule(null);
      setFormTitle("");
      setFormDueDate(toLocalDateStr());
      setFormPriority("medium");
      setFormProjectId("");
    }
    setFormNotice("");
    setShowModal(true);
  };

  // Handle Create or Update Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormNotice(tx("enter_a_schedule_title_bc5110c3"));
      return;
    }

    try {
      if (editingSchedule) {
        // Edit Schedule
        const res = await fetch(`/api/todos/${editingSchedule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            dueDate: formDueDate,
            priority: formPriority,
            projectId: formProjectId,
          }),
        });
        if (res.ok) {
          setShowModal(false);
          refreshData();
        } else {
          setFormNotice(tx("failed_to_update_schedule_e58f0093"));
        }
      } else {
        // Create Schedule
        const res = await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            dueDate: formDueDate,
            priority: formPriority,
            projectId: formProjectId,
          }),
        });
        if (res.ok) {
          setShowModal(false);
          refreshData();
        } else {
          setFormNotice(tx("failed_to_create_schedule_961df7e5"));
        }
      }
    } catch {
      setFormNotice(tx("network_error_43c4db17"));
    }
  };

  // Toggle Schedule Done Status
  const handleToggleDone = async (item: TodoItem) => {
    try {
      await fetch(`/api/todos/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !item.done }),
      });
      refreshData();
    } catch {
      // ignore
    }
  };

  // Handle Delete Schedule
  const handleDeleteConfirm = async () => {
    if (!scheduleToDelete) return;
    try {
      const res = await fetch(`/api/todos/${scheduleToDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        refreshData();
      }
    } catch {
      // ignore
    } finally {
      setScheduleToDelete(null);
    }
  };

  // Filter Schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority =
        priorityFilter === "all" || item.priority === priorityFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && !item.done) ||
        (statusFilter === "done" && item.done);

      return matchesSearch && matchesPriority && matchesStatus;
    });
  }, [schedules, searchQuery, priorityFilter, statusFilter]);

  const pendingCount = schedules.filter((s) => !s.done).length;
  const doneCount = schedules.filter((s) => s.done).length;

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs space-y-5 transition-colors">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📅</span>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              {tx("schedule_management_95968275")}</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              {tx("total_76e547a8")}{schedules.length} {tx("schedules_4a2752c3")}</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-1">
            {tx("manage_calendar_entries_titles_dates_priorities__65e18b9a")}</p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="self-start sm:self-auto px-4 py-2 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>✨</span>
          <span>{tx("new_schedule_5090d53a")}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <input
            id="schedule-panel-search"
            name="searchQuery"
            type="text"
            aria-label={tx("search_schedule_titles_517a5aba")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tx("search_schedule_titles_74510774")}
            className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200/80 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00C776]/40"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
            🔍
          </span>
        </div>

        {/* Priority Filter */}
        <select
          id="schedule-panel-priority-filter"
          name="priorityFilter"
          aria-label={tx("filter_schedules_by_priority_eaac7b54")}
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200/80 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 cursor-pointer"
        >
          <option value="all">{tx("all_priorities_73385818")}</option>
          <option value="high">{tx("high_priority_b755604e")}</option>
          <option value="medium">{tx("medium_priority_8642409d")}</option>
          <option value="low">{tx("low_priority_9add2809")}</option>
        </select>

        {/* Status Filter */}
        <select
          id="schedule-panel-status-filter"
          name="statusFilter"
          aria-label={tx("filter_schedules_by_status_3806369f")}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200/80 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 cursor-pointer"
        >
          <option value="all">{tx("all_statuses_cacda875")}{schedules.length})</option>
          <option value="pending">{tx("in_progress_ad8d3439")}{pendingCount})</option>
          <option value="done">{tx("completed_1dc0d897")}{doneCount})</option>
        </select>
      </div>

      {/* Schedules Table */}
      {filteredSchedules.length === 0 ? (
        <div className="py-12 text-center text-xs text-gray-400 bg-gray-50/50 dark:bg-slate-900/40 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
          {tx("no_matching_schedules_15097b09")}</div>
      ) : (
        <div className="overflow-x-auto border border-gray-100 dark:border-slate-700/80 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-700 text-gray-500 dark:text-slate-400">
                <th className="p-3 font-bold w-12 text-center">{tx("status_6320b4a8")}</th>
                <th className="p-3 font-bold">{tx("schedule_bbe160c4")}</th>
                <th className="p-3 font-bold w-28">{tx("project_8cea37ab")}</th>
                <th className="p-3 font-bold w-28">{tx("planned_date_01124721")}</th>
                <th className="p-3 font-bold w-24">{tx("priority_565d6460")}</th>
                <th className="p-3 font-bold w-28 text-right">{tx("actions_ed31fbb4")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
              {filteredSchedules.map((item) => {
                const matchedProj = projects.find((p) => p.id === item.projectId);

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    {/* Status Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        id={`schedule-item-check-${item.id}`}
                        name={`schedule-item-check-${item.id}`}
                        aria-label={tx("message_e72e425e69ab", {v0: item.title})}
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleToggleDone(item)}
                        className="w-4 h-4 rounded text-[#00C776] focus:ring-[#00C776] cursor-pointer"
                      />
                    </td>

                    {/* Title */}
                    <td className="p-3">
                      <span
                        className={`font-semibold ${
                          item.done
                            ? "line-through text-gray-400 dark:text-slate-500"
                            : "text-gray-900 dark:text-slate-100"
                        }`}
                      >
                        {item.title}
                      </span>
                    </td>

                    {/* Project Tag */}
                    <td className="p-3">
                      {matchedProj ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-[10px] font-medium text-gray-700 dark:text-slate-300">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: matchedProj.color || "#00C776" }}
                          />
                          <span className="truncate max-w-[90px]">{matchedProj.name}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-slate-600 text-[10px]">{tx("no_project_335f6e2b")}</span>
                      )}
                    </td>

                    {/* Due Date */}
                    <td className="p-3 text-gray-500 dark:text-slate-400 font-medium">
                      {item.dueDate ? (
                        <span className="flex items-center gap-1">
                          <span>📅</span>
                          <span>{item.dueDate}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-slate-600">-</span>
                      )}
                    </td>

                    {/* Priority Tag */}
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          item.priority === "high"
                            ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                            : item.priority === "low"
                            ? "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400"
                            : "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                        }`}
                      >
                        {item.priority === "high"
                          ? tx("high_priority_168b218c")
                          : item.priority === "low"
                          ? tx("low_priority_fe1f521d")
                          : tx("medium_priority_56fbc506")}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(item)}
                          className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 cursor-pointer"
                        >
                          {tx("edit_05183656")}</button>
                        <button
                          onClick={() => setScheduleToDelete(item)}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-600 cursor-pointer"
                        >
                          {tx("delete_2f9daa82")}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <span>📅</span>
                <span>{editingSchedule ? tx("edit_schedule_a564a40b") : tx("new_calendar_entry_dbfa0a33")}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div>
                <label
                  htmlFor="schedule-panel-form-title"
                  className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
                >
                  {tx("schedule_title_1e5349b0")}</label>
                <input
                  id="schedule-panel-form-title"
                  name="formTitle"
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={tx("e_g_prepare_the_q3_requirements_review_5462992d")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200/80 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C776]/40"
                />
              </div>

              {/* Due Date & Priority Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="schedule-panel-form-due-date"
                    className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
                  >
                    {tx("planned_date_01124721")}</label>
                  <input
                    id="schedule-panel-form-due-date"
                    name="formDueDate"
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200/80 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 cursor-pointer"
                  />
                </div>

                <div>
                  <label
                    htmlFor="schedule-panel-form-priority"
                    className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
                  >
                    {tx("priority_565d6460")}</label>
                  <select
                    id="schedule-panel-form-priority"
                    name="formPriority"
                    value={formPriority}
                    onChange={(e) =>
                      setFormPriority(e.target.value as "high" | "medium" | "low")
                    }
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200/80 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 cursor-pointer"
                  >
                    <option value="high">{tx("high_priority_b755604e")}</option>
                    <option value="medium">{tx("medium_priority_8642409d")}</option>
                    <option value="low">{tx("low_priority_9add2809")}</option>
                  </select>
                </div>
              </div>

              {/* Associated Project */}
              <div>
                <label
                  htmlFor="schedule-panel-form-project-id"
                  className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
                >
                  {tx("project_optional_4c4eb08b")}</label>
                <select
                  id="schedule-panel-form-project-id"
                  name="formProjectId"
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200/80 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C776]/40 cursor-pointer"
                >
                  <option value="">{tx("independent_entry_no_project_40693cca")}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      🗂️ {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {formNotice && (
                <div className="text-xs text-rose-500 font-semibold">{formNotice}</div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 text-xs font-semibold rounded-xl hover:bg-gray-200 cursor-pointer"
                >
                  {tx("cancel_2cd0f3be")}</button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {tx("save_schedule_c0a55a7b")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(scheduleToDelete)}
        title={tx("delete_schedule_647ed44c")}
        message={tx("message_8b5453aebeee", {v0: scheduleToDelete?.title || ""})}
        confirmLabel={tx("confirm_delete_a3ea3c17")}
        onConfirm={handleDeleteConfirm}
        onClose={() => setScheduleToDelete(null)}
      />
    </div>
  );
}
