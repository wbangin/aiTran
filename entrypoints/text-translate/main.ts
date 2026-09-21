import { browser } from 'wxt/browser';
import '../../src/ui/standalone.css';
import { translatePlainText } from '../../src/core/plain-text';
import { LANGUAGES } from '../../src/shared/constants';
import { errorMessage } from '../../src/shared/errors';
import type { RuntimeMessage, Settings } from '../../src/shared/types';

const provider = document.querySelector<HTMLSelectElement>('#provider')!;
const source = document.querySelector<HTMLSelectElement>('#source-language')!;
const target = document.querySelector<HTMLSelectElement>('#target-language')!;
const input = document.querySelector<HTMLTextAreaElement>('#input')!;
const output = document.querySelector<HTMLDivElement>('#output')!;
const status = document.querySelector<HTMLDivElement>('#status')!;
const count = document.querySelector<HTMLSpanElement>('#input-count')!;
const translateButton = document.querySelector<HTMLButtonElement>('#translate')!;
let settings: Settings;

function fillLanguages(select: HTMLSelectElement, includeAuto: boolean): void { LANGUAGES.forEach(([value,label]) => { if (includeAuto || value !== 'auto') select.add(new Option(label,value)); }); }
function fillProviders(): void {
  const free = document.createElement('optgroup'); free.label='免费组'; free.append(new Option('Microsoft Translate','microsoft'),new Option('Google Translate','google')); provider.append(free);
  const enabled=settings.customProviders.filter(item=>item.enabled); if(enabled.length){const group=document.createElement('optgroup');group.label='自定义组';enabled.forEach(item=>group.append(new Option(item.name,`custom:${item.id}`)));provider.append(group);}
  provider.value=settings.providerId;
}
function setStatus(text:string,type:'normal'|'success'|'error'='normal'):void{status.textContent=text;status.className=`status-line${type==='normal'?'':` ${type}`}`;}
async function saveSelections():Promise<void>{settings={...settings,providerId:provider.value as Settings['providerId'],sourceLanguage:source.value,targetLanguage:target.value};settings=await browser.runtime.sendMessage({type:'SAVE_SETTINGS',settings} satisfies RuntimeMessage) as Settings;}
async function initialize():Promise<void>{fillLanguages(source,true);fillLanguages(target,false);settings=await browser.runtime.sendMessage({type:'GET_SETTINGS'} satisfies RuntimeMessage) as Settings;fillProviders();source.value=settings.sourceLanguage;target.value=settings.targetLanguage;const query=new URLSearchParams(location.search).get('text');if(query){input.value=query;count.textContent=`${query.length} 字符`;}}
input.addEventListener('input',()=>{count.textContent=`${input.value.length} 字符`;});
document.querySelector('#translate')!.addEventListener('click',async()=>{const text=input.value.trim();if(!text){setStatus('请输入需要翻译的文本','error');return;}translateButton.disabled=true;output.textContent='';try{await saveSelections();const result=await translatePlainText(input.value,settings,progress=>setStatus(`正在翻译 ${progress.completed}/${progress.total}…`),'text');output.textContent=result;setStatus('翻译完成','success');}catch(error){setStatus(errorMessage(error),'error');}finally{translateButton.disabled=false;}});
document.querySelector('#copy')!.addEventListener('click',async()=>{if(output.textContent){await navigator.clipboard.writeText(output.textContent);setStatus('译文已复制','success');}});
document.querySelector('#clear')!.addEventListener('click',()=>{input.value='';output.textContent='';count.textContent='0 字符';setStatus('已清空');});
document.querySelector('#swap')!.addEventListener('click',()=>{if(source.value==='auto'){source.value=target.value;target.value='en';}else{const old=source.value;source.value=target.value;target.value=old;}const translated=output.textContent;if(translated){input.value=translated;output.textContent='';count.textContent=`${input.value.length} 字符`;}});
document.querySelector('#open-options')!.addEventListener('click',()=>void browser.runtime.openOptionsPage());
void initialize().catch(error=>setStatus(errorMessage(error),'error'));
