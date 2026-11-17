import {createHash,randomUUID} from 'node:crypto';
import {getChatGPTUser} from '../../chatgpt-auth';
import {canEditLeads} from '../../access-policy';
import {aggregateMonthly,emptyMonthlyManual,monthlyPerson,monthlyToday,validMonthlyPeriod,validateMonthlyManual,type MonthlyAutomatic,type MonthlyReport} from '../../sale-monthly-model';
import {readSaleWorkspace} from '../../../lib/sale-leads';
import {readPrivate,transactPrivate} from '../../../lib/private-store';
export const dynamic='force-dynamic';export const runtime='nodejs';
const path='labcos/sale-monthly-reports.json',headers={'Cache-Control':'private, no-store'};
type Store={reports:MonthlyReport[]};
const tag=(auto:MonthlyAutomatic)=>createHash('sha256').update(JSON.stringify(auto)).digest('hex');
function identity(month:unknown,person:unknown){if(!validMonthlyPeriod(month)||typeof person!=='string'||!person.trim()||person.length>120)throw new Error('INPUT');return {month,person:person.trim()};}
const match=(r:MonthlyReport,month:string,person:string)=>r.month===month&&monthlyPerson(r.person)===monthlyPerson(person);
function failure(error:unknown){const code=error instanceof Error?error.message:'',status=code==='INPUT'||error instanceof SyntaxError?400:code==='CONFLICT'||code==='CRM_CHANGED'?409:503;return Response.json({error:code==='CRM_CHANGED'?'Dữ liệu CRM đã thay đổi. Bấm Cập nhật từ CRM rồi lưu lại; phần đang nhập được giữ.':status===409?'Báo cáo vừa được người khác lưu. Tải lại báo cáo trước khi sửa tiếp; bản đang nhập vẫn được giữ.':status===400?'Kiểm tra tháng, tên Sale, số lượng nguyên không âm và độ dài ghi chú.':'Chưa xử lí được báo cáo. Nội dung đã lưu vẫn được giữ.'},{status,headers});}
export async function GET(request:Request){const user=await getChatGPTUser(true);if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});if(user.role==='order')return Response.json({error:'Không có quyền xem báo cáo Sale.'},{status:403,headers});try{
 const url=new URL(request.url),{month,person}=identity(url.searchParams.get('month')||monthlyToday(),url.searchParams.get('person')||user.fullName||user.displayName||user.email);
 const [{dashboard},store]=await Promise.all([readSaleWorkspace(),readPrivate<Store>(path,{reports:[]})]);const saved=store.reports.find(r=>match(r,month,person))||null;
 const refresh=url.searchParams.get('refresh')==='1',automatic=refresh||!saved?aggregateMonthly(dashboard.leads,month,person):saved.automatic;
 const persons=[...new Set([person,...dashboard.leads.map(l=>l.sales||'Chưa phân công'),...store.reports.map(r=>r.person)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
 return Response.json({month,person,persons,canEdit:canEditLeads(user.role),saved,manual:saved?.manual||emptyMonthlyManual(),automatic,autoTag:tag(automatic),refreshAuto:refresh||!saved,checkedAt:new Date().toISOString(),reports:store.reports.map(({month,person,updated_at})=>({month,person,updated_at}))},{headers});
 }catch(error){return failure(error)}}
export async function POST(request:Request){const user=await getChatGPTUser(true);if(!user)return Response.json({error:'Cần đăng nhập.'},{status:401,headers});if(!canEditLeads(user.role))return Response.json({error:'Tài khoản chỉ có quyền xem.'},{status:403,headers});if(request.headers.get('origin')!==new URL(request.url).origin||!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403,headers});try{
 const text=await request.text();if(text.length>128000)throw new Error('INPUT');const input=JSON.parse(text);if(!input||Array.isArray(input))throw new Error('INPUT');const {month,person}=identity(input.month,input.person),manual=validateMonthlyManual(input.manual);if(!(input.revision===null||typeof input.revision==='string')||typeof input.autoTag!=='string'||typeof input.refreshAuto!=='boolean')throw new Error('INPUT');
 const {dashboard}=await readSaleWorkspace(),fresh=aggregateMonthly(dashboard.leads,month,person),at=new Date().toISOString();
 const next=await transactPrivate<Store>(path,{reports:[]},store=>{const existing=store.reports.find(r=>match(r,month,person));if((existing?.revision||null)!==input.revision)throw new Error('CONFLICT');const automatic=input.refreshAuto||!existing?fresh:existing.automatic;if(tag(automatic)!==input.autoTag)throw new Error('CRM_CHANGED');const report:MonthlyReport={month,person,revision:randomUUID(),manual,automatic,updated_at:at,updated_by:user.email,history:[...(existing?.history||[]),{at,by:user.email,manual,automatic}]};if(existing)store.reports[store.reports.indexOf(existing)]=report;else store.reports.push(report);return store;});
 const saved=next.reports.find(r=>match(r,month,person))!;return Response.json({saved,automatic:saved.automatic,autoTag:tag(saved.automatic)},{headers});
 }catch(error){return failure(error)}}
