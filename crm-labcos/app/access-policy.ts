export type UserRole='owner'|'manager'|'sale_admin'|'sale_oem'|'viewer'|'designer'|'order';
export type AccountRole=Exclude<UserRole,'owner'>;
export const roleLabels:Record<UserRole,string>={owner:'Quản trị',manager:'Trưởng bộ phận',sale_admin:'Sale Admin',sale_oem:'Sale OEM',viewer:'Quyền chỉ xem',designer:'Designer',order:'Order'};
export function canManageAccounts(role:UserRole|null){return role==='owner'||role==='manager';}
export function canEditWorkspace(role:UserRole|null){return role==='owner'||role==='manager'||role==='sale_admin';}
export function canEditLeads(role:UserRole|null){return canEditWorkspace(role)||role==='sale_oem';}
export function canAccessTab(role:UserRole|null,tab:string){
 if(!role)return false;
 if(role==='order')return ['designer','designer-performance'].includes(tab);
 if(role==='sale_oem')return ['leads','list-lead','sale-performance','sale-lead-report','designer'].includes(tab);
 return tab!=='users'||canManageAccounts(role);
}
export function defaultTab(role:UserRole){return role==='sale_oem'?'leads':role==='order'?'designer':'overview';}
export function designerLanding(role:UserRole|null){return role==='designer'||role==='sale_oem'?'designer':'designer-performance';}
