import { createHash } from 'node:crypto';
import { dashboardRole, requireOwnerWrite } from '../../roles';
import { readPrivate, writePrivate } from '../../../lib/private-store';

export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

type Insight = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: Array<{ action_type: string; value: string }>;
};
type MetaResponse<T> = { data?: T[]; paging?: { next?: string }; error?: { message?: string; code?: number } };
type AccountResponse = { currency?: string; error?: { code?: number } };
type Campaign = { id: string; objective?: string; effective_status?: string; start_time?: string };
type AdSet = { campaign_id?: string; optimization_goal?: string; destination_type?: string };
type Ad = { campaign_id?: string; creative?: { thumbnail_url?: string } };
type StoredCredential = { encrypted_token: string; iv: string };

const accountName = "OEM LABCOS 2";
const periods = new Set(["this_month", "last_month", "this_quarter", "custom_month"]);
const noStore = { "Cache-Control": "private, no-store" };

function config() {
  return process.env;
}
function accountId() { return config().META_AD_ACCOUNT_ID?.replace(/^act_/, "").trim(); }
function bytes(value: string) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }
function base64(value: Uint8Array) { return btoa(String.fromCharCode(...value)); }
async function encryptionKey() {
  const secret=config().AUTH_SESSION_SECRET;
  if (!secret || secret.length<24) throw new Error('AUTH_SESSION_SECRET unavailable');
  const raw=createHash('sha256').update(`labcos-meta:${secret}`).digest();
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function storedToken() {
  const row = await readPrivate<StoredCredential|null>('labcos/meta-credential.json',null);
  if (!row) return null;
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(row.iv) }, await encryptionKey(), bytes(row.encrypted_token));
  return new TextDecoder().decode(plaintext);
}
function metaMessage(code?: number) {
  if (code === 190) return "Mã truy cập Meta đã hết hạn hoặc không hợp lệ. Hãy tạo mã mới.";
  if (code === 10 || code === 200) return "Mã chưa có quyền ads_read hoặc chưa được gán tài khoản quảng cáo này.";
  return "Meta chưa trả được báo cáo. Kiểm tra quyền, tài khoản quảng cáo và thử lại.";
}

function actionValue(actions: Insight["actions"], primary: string, fallback?: string) {
  const found = actions?.find(action => action.action_type === primary) || (fallback ? actions?.find(action => action.action_type === fallback) : undefined);
  return Number(found?.value || 0);
}
function campaignModel(name: string) {
  const normalized = name.toLocaleUpperCase("vi");
  if (normalized.includes("OEM")) return "OEM";
  if (normalized.includes("XẢ SỈ") || normalized.includes("XA SI")) return "Xả sỉ";
  return null;
}
function campaignGoal(objective?: string, adSets: AdSet[] = []) {
  if (adSets.some(adSet => adSet.optimization_goal === "CONVERSATIONS" || adSet.optimization_goal === "MESSAGING_CONVERSATION_STARTED_7D" || ["MESSENGER", "INSTAGRAM_DIRECT", "WHATSAPP"].includes(adSet.destination_type || ""))) return "Tin nhắn";
  const goals: Record<string, string> = { OUTCOME_AWARENESS: "Nhận diện", OUTCOME_TRAFFIC: "Lưu lượng", OUTCOME_ENGAGEMENT: "Tương tác", OUTCOME_LEADS: "Lead", OUTCOME_SALES: "Doanh số", OUTCOME_APP_PROMOTION: "Ứng dụng" };
  return objective ? goals[objective] || objective : null;
}
async function optionalMeta<T>(url: URL, headers: Record<string, string>): Promise<T[]> {
  try {
    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) return [];
    return (await response.json() as MetaResponse<T>).data || [];
  } catch { return []; }
}

function reportRange(request: Request) {
  const params = new URL(request.url).searchParams;
  const period = params.get("period") || "this_month";
  if (!periods.has(period)) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const currentYear = Number(parts.find(part => part.type === "year")?.value);
  const currentMonth = Number(parts.find(part => part.type === "month")?.value);
  const currentDay = Number(parts.find(part => part.type === "day")?.value);
  let year = currentYear, month = currentMonth;
  if (period === "last_month") {
    month--;
    if (month === 0) { month = 12; year--; }
  }
  if (period === "custom_month") {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(params.get("month") || "");
    if (!match) return null;
    year = Number(match[1]); month = Number(match[2]);
    if (year < 2020 || year > currentYear || year === currentYear && month > currentMonth) return null;
  }
  const format = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const startMonth = period === "this_quarter" ? Math.floor((currentMonth - 1) / 3) * 3 + 1 : month;
  const current = period === "this_month" || period === "this_quarter" || period === "custom_month" && year === currentYear && month === currentMonth;
  return {
    period,
    since: format(year, startMonth, 1),
    until: current ? format(currentYear, currentMonth, currentDay) : format(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate()),
  };
}

export async function GET(request: Request) {
  if (!await dashboardRole()) return Response.json({ error: 'Cần đăng nhập để xem Meta Ads.' }, { status: 401, headers: noStore });
  const id = accountId();
  if (!id || !/^\d+$/.test(id)) {
    return Response.json({ status: "unconfigured", accountName, message: "Chưa cấu hình ID tài khoản quảng cáo." }, { headers: noStore });
  }
  let token: string | null;
  try { token = await storedToken(); }
  catch (error) {
    console.error("Meta credential read failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ status: "error", accountName, message: "Chưa đọc được cấu hình Meta. Thử lại sau." }, { status: 500, headers: noStore });
  }
  if (!token) {
    return Response.json({ status: "unconfigured", accountName, accountId: id, message: "Chưa nhập mã truy cập Meta." }, { headers: noStore });
  }

  const range = reportRange(request);
  if (!range) return Response.json({ status: "error", accountName, message: "Tháng báo cáo không hợp lệ." }, { status: 400, headers: noStore });
  const base = `https://graph.facebook.com/v25.0/act_${id}`;
  const headers = { Authorization: `Bearer ${token}` };
  const summaryUrl = new URL(`${base}/insights`);
  summaryUrl.searchParams.set("fields", "spend,impressions,clicks,ctr,cpc");
  summaryUrl.searchParams.set("time_range", JSON.stringify({ since: range.since, until: range.until }));
  summaryUrl.searchParams.set("level", "account");
  const campaignsUrl = new URL(`${base}/insights`);
  campaignsUrl.searchParams.set("fields", "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions");
  campaignsUrl.searchParams.set("time_range", JSON.stringify({ since: range.since, until: range.until }));
  campaignsUrl.searchParams.set("level", "campaign");
  campaignsUrl.searchParams.set("limit", "100");
  const accountUrl = new URL(base);
  accountUrl.searchParams.set("fields", "currency");
  const campaignInfoUrl = new URL(`${base}/campaigns`);
  campaignInfoUrl.searchParams.set("fields", "id,objective,effective_status,start_time");
  campaignInfoUrl.searchParams.set("limit", "500");
  const adSetUrl = new URL(`${base}/adsets`);
  adSetUrl.searchParams.set("fields", "campaign_id,optimization_goal,destination_type");
  adSetUrl.searchParams.set("limit", "500");
  const adUrl = new URL(`${base}/ads`);
  adUrl.searchParams.set("fields", "campaign_id,creative{thumbnail_url}");
  adUrl.searchParams.set("limit", "500");

  try {
    const [summaryResponse, campaignsResponse, accountResponse, campaignInfo, adSets, ads] = await Promise.all([
      fetch(summaryUrl, { headers, cache: "no-store" }),
      fetch(campaignsUrl, { headers, cache: "no-store" }),
      fetch(accountUrl, { headers, cache: "no-store" }),
      optionalMeta<Campaign>(campaignInfoUrl, headers),
      optionalMeta<AdSet>(adSetUrl, headers),
      optionalMeta<Ad>(adUrl, headers),
    ]);
    const [summaryBody, campaignsBody, accountBody] = await Promise.all([
      summaryResponse.json() as Promise<MetaResponse<Insight>>,
      campaignsResponse.json() as Promise<MetaResponse<Insight>>,
      accountResponse.json() as Promise<AccountResponse>,
    ]);
    if (!summaryResponse.ok || !campaignsResponse.ok || !accountResponse.ok) {
      const code = summaryBody.error?.code || campaignsBody.error?.code || accountBody.error?.code;
      return Response.json({ status: "error", accountName, message: metaMessage(code) }, { status: 502, headers: noStore });
    }
    const infoById = new Map(campaignInfo.map(item => [item.id, item]));
    const adSetsByCampaign = new Map<string, AdSet[]>();
    for (const item of adSets) if (item.campaign_id) adSetsByCampaign.set(item.campaign_id, [...(adSetsByCampaign.get(item.campaign_id) || []), item]);
    const imageByCampaign = new Map<string, string>();
    for (const ad of ads) {
      const image = ad.creative?.thumbnail_url;
      if (ad.campaign_id && image?.startsWith("https://") && !imageByCampaign.has(ad.campaign_id)) imageByCampaign.set(ad.campaign_id, image);
    }
    const campaigns = (campaignsBody.data || []).map(item => {
      const campaignId = item.campaign_id || "";
      const info = infoById.get(campaignId);
      const messages = actionValue(item.actions, "onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.messaging_first_reply");
      const comments = actionValue(item.actions, "comment", "onsite_conversion.post_comment");
      return {
        campaign_id: campaignId,
        campaign_name: item.campaign_name || "",
        objective: campaignGoal(info?.objective, adSetsByCampaign.get(campaignId)),
        model: campaignModel(item.campaign_name || ""),
        image_url: imageByCampaign.get(campaignId) || null,
        start_date: info?.start_time?.slice(0, 10) || null,
        status: info?.effective_status || null,
        spend: item.spend,
        leads_meta: messages + comments,
        messages,
        comments,
        impressions: item.impressions,
        clicks: item.clicks,
        ctr: item.ctr,
        cpc: item.cpc,
        cpm: item.cpm,
        engagement: actionValue(item.actions, "post_engagement"),
      };
    });
    return Response.json({
      status: "connected",
      accountName,
      accountId: id,
      currency: accountBody.currency,
      period: range.period,
      range: { since: range.since, until: range.until },
      updatedAt: new Date().toISOString(),
      summary: summaryBody.data?.[0] || { spend: "0", impressions: "0", clicks: "0", ctr: "0", cpc: "0" },
      campaigns,
      hasMoreCampaigns: Boolean(campaignsBody.paging?.next),
    }, { headers: noStore });
  } catch (error) {
    console.error("Meta Insights request failed", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ status: "error", accountName, message: "Không kết nối được Meta lúc này. Thử tải lại sau." }, { status: 502, headers: noStore });
  }
}

export async function POST(request: Request) {
  const denied = await requireOwnerWrite(); if (denied) return denied;
  const origin = request.headers.get("Origin");
  if (origin !== new URL(request.url).origin || !request.headers.get("Content-Type")?.startsWith("application/json")) {
    return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 403, headers: noStore });
  }
  const id = accountId();
  if (!id || !/^\d+$/.test(id)) return Response.json({ error: "Chưa cấu hình tài khoản quảng cáo." }, { status: 500, headers: noStore });
  let token: string;
  try { token = String((await request.json() as { token?: unknown }).token || "").trim(); }
  catch { return Response.json({ error: "Mã không hợp lệ." }, { status: 400, headers: noStore }); }
  if (token.length < 16 || token.length > 4096 || /\s/.test(token)) {
    return Response.json({ error: "Kiểm tra lại mã truy cập Meta." }, { status: 400, headers: noStore });
  }
  const testUrl = new URL(`https://graph.facebook.com/v25.0/act_${id}/insights`);
  testUrl.searchParams.set("fields", "spend");
  testUrl.searchParams.set("date_preset", "last_7d");
  try {
    const test = await fetch(testUrl, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!test.ok) {
      const body = await test.json() as MetaResponse<Insight>;
      return Response.json({ error: metaMessage(body.error?.code) }, { status: 400, headers: noStore });
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(token));
    await writePrivate('labcos/meta-credential.json',{encrypted_token:base64(new Uint8Array(ciphertext)),iv:base64(iv),updated_at:new Date().toISOString()});
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("Meta credential save failed", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ error: "Chưa lưu được mã truy cập. Thử lại sau." }, { status: 500, headers: noStore });
  }
}
