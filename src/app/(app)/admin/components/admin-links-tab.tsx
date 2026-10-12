"use client";

import { useTranslations } from "next-intl";
import AddCategoryModal from "@/components/add-category-modal";
import AddLinkModal from "@/components/add-link-modal";
import ConfirmDialog from "@/components/confirm-dialog";
import Modal from "@/components/modal";
import Toast from "@/components/toast";
import { useAdminLinks } from "@/hooks/use-admin-links";
import {
  buildCategoryDeleteMessage,
  buildLinkDeleteMessage,
} from "@/lib/admin-links";
import AdminLinksTableCard from "./admin-links-table-card";
import AdminCategoriesTableCard from "./admin-categories-table-card";
import AdminQuickAccessCard from "./admin-quick-access-card";

/**
 * 「链接管理」Tab 的组装层。
 *
 * 原文件 764 行、14 个 useState，把「链接列表」「分组管理」「快捷访问管理」
 * 三个互不相关的子视图与 3 个确认弹窗挤在一个组件里。现按视图拆分：
 *   - 状态与副作用（过滤 / 分页 / 统计 / 增删改）→ `@/hooks/use-admin-links`
 *   - 纯逻辑（分组名回退、过滤、分页、点击统计、弹窗文案）→ `@/lib/admin-links`
 *   - 三个子视图 → 同目录 `admin-links-table-card` / `admin-categories-table-card`
 *     / `admin-quick-access-card`
 * 本文件只保留 Tab 分支编排、三个弹窗与 Toast。
 */

type AdminTab =
  | "links"
  | "categories"
  | "quickAccess";

interface AdminLinksTabProps {
  activeTab: AdminTab;
}

export default function AdminLinksTab({ activeTab }: AdminLinksTabProps) {
  const tx = useTranslations();
  const {
    categories,
    links,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    filteredLinks,
    paginatedLinks,
    totalPages,
    statuses,
    refreshStatuses,
    showAddLink,
    editingLink,
    openAddLink,
    openEditLink,
    closeAddLink,
    showAddCategory,
    editingCategory,
    openAddCategory,
    openEditCategory,
    closeAddCategory,
    showClearAllConfirm,
    openClearAllConfirm,
    closeClearAllConfirm,
    linkToDelete,
    setLinkToDelete,
    categoryToDelete,
    setCategoryToDelete,
    linksInCategory,
    handleLinkSave,
    handleCategorySave,
    handleDeleteLink,
    handleDeleteCategory,
    handleClearAllLinks,
    toggleQuickAccess,
    notice,
    notify,
  } = useAdminLinks();

  return (
    <>
      {/* Notice Flash */}
      <Toast message={notice} variant="toast" />

      {/* TAB 1: 🔗 链接管理 */}
      {activeTab === "links" && (
        <AdminLinksTableCard
          links={links}
          filteredLinks={filteredLinks}
          paginatedLinks={paginatedLinks}
          totalPages={totalPages}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          categories={categories}
          statuses={statuses}
          refreshStatuses={refreshStatuses}
          onAddLink={openAddLink}
          onEditLink={openEditLink}
          onDeleteLink={setLinkToDelete}
          onClearAll={openClearAllConfirm}
        />
      )}

      {/* TAB 2: 🗂️ 分组管理 */}
      {activeTab === "categories" && (
        <AdminCategoriesTableCard
          categories={categories}
          links={links}
          onAddCategory={openAddCategory}
          onEditCategory={openEditCategory}
          onDeleteCategory={setCategoryToDelete}
          onNotify={notify}
        />
      )}

      {/* TAB: ⚡ 快捷访问管理 */}
      {activeTab === "quickAccess" && (
        <AdminQuickAccessCard
          links={links}
          filteredLinks={filteredLinks}
          categories={categories}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          onToggleQuickAccess={toggleQuickAccess}
          onNotify={notify}
        />
      )}

      {/* Modals */}
      <AddLinkModal
        key={showAddLink ? (editingLink?.id ?? "new-link") : "closed-link"}
        open={showAddLink}
        categories={categories}
        defaultCategory={filterCategory !== "all" ? filterCategory : undefined}
        link={editingLink}
        onClose={closeAddLink}
        onAdd={handleLinkSave}
      />

      <AddCategoryModal
        key={
          showAddCategory
            ? (editingCategory?.id ?? "new-category")
            : "closed-category"
        }
        open={showAddCategory}
        category={editingCategory}
        onClose={closeAddCategory}
        onAdd={handleCategorySave}
      />

      {/* Confirm Delete All Links Modal */}
      <Modal
        open={showClearAllConfirm}
        title={tx("clear_all_links_2e1ece4a")}
        onClose={closeClearAllConfirm}
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
            {tx("this_will_permanently_delete_all_d319e5dc")}<strong className="text-rose-600 font-bold">{links.length} {tx("items_3a116815")}</strong> {tx("bookmarks_and_their_quick_access_entries_from_yo_39698223")}<strong className="text-rose-600 font-bold">{tx("this_action_cannot_be_undone_025cc78e")}</strong>
          </p>
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
            <button
              onClick={closeClearAllConfirm}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 cursor-pointer transition-colors"
            >
              {tx("cancel_2cd0f3be")}</button>
            <button
              onClick={handleClearAllLinks}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs cursor-pointer transition-colors"
            >
              {tx("clear_all_d530c285")}{links.length} {tx("items_6f39ceb1")}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!linkToDelete}
        title={tx("delete_link_e8feb91c")}
        message={buildLinkDeleteMessage(linkToDelete?.title)}
        onConfirm={handleDeleteLink}
        onClose={() => setLinkToDelete(null)}
      />

      <ConfirmDialog
        open={!!categoryToDelete}
        title={tx("delete_category_7605c1d8")}
        message={buildCategoryDeleteMessage(categoryToDelete?.name, linksInCategory)}
        onConfirm={handleDeleteCategory}
        onClose={() => setCategoryToDelete(null)}
      />
    </>
  );
}
