'use client';
import {designerStatusTone,designerTypeStyle} from './designer-options';
type Props={kind:'type'|'status';label:string;value:string;display:string;options:{value:string;label:string}[];disabled?:boolean;editable:boolean;onChange:(value:string)=>void};
export default function DesignerChoice({kind,label,value,display,options,disabled,editable,onChange}:Props){
 const className=`design-tag ${kind==='status'?`design-status-${designerStatusTone(display)}`:'design-type'}`;
 const style=kind==='type'?designerTypeStyle(display):undefined;
 return editable?<select className={`${className} design-tag-select`} style={style} aria-label={label} title={display} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:<span className={className} style={style}>{display||'Chưa ghi'}</span>;
}
