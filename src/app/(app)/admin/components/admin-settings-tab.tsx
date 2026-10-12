"use client";

import { useTranslations } from "next-intl";
import { useSystemSecretClear } from "@/hooks/use-system-secret-clear";
import { useState } from "react";
import { useNavelixConfig } from "@/context/navelix-context";
import Toast from "@/components/toast";
import { useToast } from "@/hooks/use-toast";
import { useAdminTelegramSettings } from "@/hooks/use-admin-telegram-settings";
import { useAdminDataTransfer } from "@/hooks/use-admin-data-transfer";
import { useAdminLicense } from "@/hooks/use-admin-license";
import { useAdminCloudStorage } from "@/hooks/use-admin-cloud-storage";
import { useConfirm } from "@/hooks/use-confirm";
import ConfirmDialog from "@/components/confirm-dialog";
import AdminPersonalizationTab from "./admin-personalization-tab";
import AdminProfileTab from "./admin-profile-tab";
import AdminProfileTelegramCard from "./admin-profile-telegram-card";
import AdminProfileSocialCard from "./admin-profile-social-card";
import AdminProfileAiCard from "./admin-profile-ai-card";
import AdminSystemAccessCard from "./admin-system-access-card";
import AdminSystemTab from "./admin-system-tab";
import AdminSystemDataTransferCard from "./admin-system-data-transfer-card";
import AdminProBrandCard from "./admin-pro-brand-card";
import AdminProLinkProbeCard from "./admin-pro-link-probe-card";
import AdminProCodeInjectionCard from "./admin-pro-code-injection-card";
import AdminProLicenseModal from "./admin-pro-license-modal";
import AdminProStorageCard from "./admin-pro-storage-card";
import AdminProBackupListModal from "./admin-pro-backup-list-modal";

function NotificationSettings({ isAdmin }: { isAdmin: boolean }) {
  const { notice, flash } = useToast();
  const tg = useAdminTelegramSettings({ flash });
  return <><Toast message={notice} /><AdminProfileTelegramCard tg={tg} isAdmin={isAdmin} /></>;
}
function PersonalDataSettings() {
  const { notice, flash, notify } = useToast();
  const transfer = useAdminDataTransfer({ flash, notify });
  return <><Toast message={notice} /><AdminSystemDataTransferCard transfer={transfer} /></>;
}
function AISettings() {
  const { notice, notify } = useToast();
  return <><Toast message={notice} /><AdminProfileAiCard notify={notify} /></>;
}
function ProSystemSettings() {
  const tx = useTranslations();
  const { notice, flash } = useToast(3200);
  const confirm = useConfirm();
  const license = useAdminLicense({ flash, confirm: confirm.confirm });
  const storage = useAdminCloudStorage({ flash, confirm: confirm.confirm });
  return <div className="space-y-6">
    <Toast message={notice} />
    <ConfirmDialog {...confirm.dialogProps} />
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">{tx("pro_system_features_b5b9bc21")}</h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{tx("system_level_pro_features_in_one_place_91348d71")}</p>
    </div>
    <AdminProBrandCard licenseStatus={license.licenseStatus} flash={flash} />
    <AdminProStorageCard storage={storage} licenseStatus={license.licenseStatus} openLicenseModal={license.openLicenseModal} />
    <AdminProCodeInjectionCard licenseStatus={license.licenseStatus} />
    <AdminProLinkProbeCard licenseStatus={license.licenseStatus} onLockedClick={license.openLicenseModal} />
    {license.licenseModalOpen && <AdminProLicenseModal license={license} />}
    {storage.showBackupListModal && <AdminProBackupListModal
      loading={storage.loadingBackups}
      backups={storage.remoteBackups}
      restoringFileName={storage.restoringFileName}
      onRestore={storage.restoreFromCloud}
      onClose={storage.closeBackupListModal}
    />}
  </div>;
}
function SiteSettings() {
  const tx = useTranslations();
  const { config, updateConfig } = useNavelixConfig();
  return <div className="space-y-6">
    <label className="block text-sm">{tx("footer_db7eeb8d")}<input aria-label={tx("footer_db7eeb8d")} className="block w-full rounded-xl border p-3 dark:bg-slate-900" defaultValue={config.customFooter} onBlur={event => updateConfig({ customFooter: event.target.value })} /></label>
    <AdminProfileSocialCard />
  </div>;
}
function WeatherSettings() {
  const tx = useTranslations();
  const { config, updateConfig } = useNavelixConfig();
  const secret = useSystemSecretClear();
  const [key, setKey] = useState("");
  return <div className="space-y-5 p-6 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
    <h2 className="font-bold">{tx("weather_service_85663f49")}</h2>
    <label className="flex gap-2"><input type="checkbox" checked={config.weatherEnabled} onChange={event => updateConfig({ weatherEnabled: event.target.checked })} />{tx("enable_weather_service_e5832a1a")}</label>
    <label className="block text-sm">API Key（{config.weatherKeyConfigured ? tx("configured_de8184da") : tx("not_configured_80a57e03")}）
      <input type="password" autoComplete="new-password" className="block w-full border rounded-xl p-3 dark:bg-slate-800" value={key} onChange={event => setKey(event.target.value)} onBlur={() => { if (key.trim()) { updateConfig({ weatherApiKey: key.trim() }); setKey(""); } }} placeholder={tx("enter_a_new_key_leave_blank_to_keep_the_current__00942e07")} />
    </label>
    <button type="button" onClick={() => secret.clear("weatherApiKey")} className="text-sm text-rose-600">{tx("clear_weather_api_key_c60086fb")}</button>
    {secret.error && <p role="alert">{secret.error}</p>}
    <label className="block text-sm">{tx("location_1fb4d574")}<input className="block w-full border rounded-xl p-3 dark:bg-slate-800" defaultValue={config.weatherLocation} onBlur={event => updateConfig({ weatherLocation: event.target.value })} /></label>
    <label className="block text-sm">{tx("api_endpoint_03b11112")}<input type="url" className="block w-full border rounded-xl p-3 dark:bg-slate-800" defaultValue={config.weatherApiBaseUrl} onBlur={event => updateConfig({ weatherApiBaseUrl: event.target.value })} /></label>
  </div>;
}
export default function AdminSettingsTab({ tab, isAdmin }: { tab: string; isAdmin: boolean }) {
  switch (tab) {
    case "profile": return <AdminProfileTab section="profile" />;
    case "account": return <AdminProfileTab section="account" />;
    case "personalization": return <AdminPersonalizationTab />;
    case "notifications": return <NotificationSettings isAdmin={isAdmin} />;
    case "personalData": return <PersonalDataSettings />;
    case "ai": return <AISettings />;
    case "weather": return <WeatherSettings />;
    case "access": return <AdminSystemAccessCard isAdmin={isAdmin} />;
    case "proSystem": return <ProSystemSettings />;
    case "site": return <SiteSettings />;
    default: return <AdminSystemTab currentUser={{ role: "admin" }} />;
  }
}
