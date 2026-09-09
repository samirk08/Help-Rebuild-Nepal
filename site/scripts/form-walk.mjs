/**
 * Walks the three-step need form the way a person does, in a real browser.
 *
 * This exists because nothing else did. Every test called `validateNeedV3`
 * directly with a complete payload — a fine way to test validation and no way
 * at all to test a form — so the form shipped deadlocked and stayed that way
 * until a coordinator trying to file a real request reported being told to tick
 * a consent box that was not on the page.
 *
 * Needs the dev server and a Chrome with remote debugging:
 *
 *   npm run dev
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\
 *     --headless --remote-debugging-port=9336 --user-data-dir=/tmp/formwalk about:blank
 *   node scripts/form-walk.mjs
 *
 * Reaching "3 Check and send" with no error banner is the pass. Submission
 * itself needs a real database, so against placeholder credentials the walk
 * ends on the page with the request unsaved — which is expected, and still
 * proves every client-side gate was cleared.
 */
const PORT = Number(process.env.CDP_PORT || 9336);

const t=await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`,{method:"PUT"})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl); let id=0; const p=new Map();
ws.addEventListener("message",e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m.result);p.delete(m.id);}});
await new Promise(r=>ws.addEventListener("open",r));
const send=(m,q={})=>new Promise(res=>{const n=++id;p.set(n,res);ws.send(JSON.stringify({id:n,method:m,params:q}));});
const ev=async e=>(await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true})).result?.value;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await send("Page.enable");
await send("Page.navigate",{url:"http://127.0.0.1:3000/en/post"});
await wait(4500);

const setVal=(name,value)=>ev(`(()=>{
  const els=[...document.querySelectorAll('[name="${name}"]')];
  if(!els.length) return "MISSING";
  const el=els[0];
  if(el.type==="radio"){const m=els.find(x=>x.value===${JSON.stringify(value)}); if(!m) return "no option"; m.click(); return m.value;}
  const proto=el.tagName==="SELECT"?HTMLSelectElement:el.tagName==="TEXTAREA"?HTMLTextAreaElement:HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype,"value").set.call(el,${JSON.stringify(value)});
  el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new Event("change",{bubbles:true}));
  return el.value;
})()`);

// The district combobox: focus the visible box, type, then click the option.
const pickDistrict = async (text) => {
  const ok = await ev(`(()=>{const i=document.getElementById("n3-district"); if(!i) return false; i.focus(); return true;})()`);
  if(!ok) return "no combobox input";
  await send("Input.insertText",{text});
  await wait(900);
  // The list commits on mousedown (it must beat blur), so a synthetic .click()
  // never commits. Enter is the keyboard path and does the same thing.
  await send("Input.dispatchKeyEvent",{type:"rawKeyDown",windowsVirtualKeyCode:13,key:"Enter",code:"Enter"});
  await send("Input.dispatchKeyEvent",{type:"keyUp",windowsVirtualKeyCode:13,key:"Enter",code:"Enter"});
  await wait(500);
  return ev(`(()=>{const h=document.querySelector('input[type=hidden][name="n3-district"]'); return "hidden="+(h?h.value:"none");})()`);
};

const step=()=>ev(`(()=>{const li=document.querySelector('li[aria-current="step"]');return li?li.innerText.replace(/\\s+/g," ").trim():"?";})()`);
const errs=()=>ev(`(()=>{const s=document.querySelector('[role=alert]');return s?s.innerText.replace(/\\s+/g," ").trim().slice(0,220):null;})()`);
const click=re=>ev(`(()=>{const b=[...document.querySelectorAll("button")].find(x=>${re}.test(x.textContent||"")); if(!b) return "NO BUTTON"; b.click(); return b.textContent.trim();})()`);

await setVal("n3-type","Skilled volunteers");
await setVal("n3-title","Check twelve damaged homes");
await setVal("n3-detail","Twelve houses in the ward have visible cracks and we need someone qualified to say which are safe to live in.");
console.log("district:", await pickDistrict("Sindhupalchok"));
await setVal("n3-work-mode","On site");
await setVal("n3-urgency","Immediate");
await wait(700);
console.log("hidden district value:", await ev(`(()=>{const h=document.querySelector('input[type=hidden][name="n3-district"]'); return h?h.value:"none";})()`));
console.log("-> continue:", await click(/continue/i));
await wait(1400);
console.log("STEP:", await step(), "| err:", await errs());

await setVal("n3-organization","Ward 4 recovery group");
await setVal("n3-email","ward4@example.org");
await wait(700);
console.log("-> continue:", await click(/continue|check/i));
await wait(1600);
console.log("STEP:", await step());
console.log("ERROR:", await errs());
console.log("consent box on this step?", await ev(`!!document.querySelector('[name="consent"]')`));

// Tick consent and submit for real.
console.log("tick consent:", await ev(`(()=>{const c=document.querySelector('[name="consent"]'); if(!c) return "NO BOX"; c.click(); return c.checked;})()`));
await wait(600);
console.log("-> submit:", await click(/send|submit|post/i));
await wait(3000);
console.log("FINAL STEP:", await step());
console.log("FINAL ERROR:", await errs());
console.log("url:", await ev(`location.pathname`));
ws.close(); process.exit(0);