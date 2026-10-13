"use strict";
(() => {
  const banks = window.QUESTION_BANKS || [];
  const allQuestions = banks.flatMap(bank => bank.questions);
  const byId = new Map(allQuestions.map(question => [question.id, question]));
  const SAVED_SESSION = "family-business-rk1-session-v1";
  const SAVED_SCORES = "family-business-rk1-scores-v1";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const readStore = key => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
  const saveStore = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); } catch { /* Private mode: use in-memory progress. */ } };
  const dropStore = key => { try { localStorage.removeItem(key); } catch {} };
  const shuffleArray = items => {
    const arr=[...items];
    for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
    return arr;
  };
  const formatTime = ms => {const s=Math.max(0,Math.round(ms/1000));return s>=3600?`${Math.floor(s/3600)} ч ${Math.floor(s%3600/60)} мин`:s>=60?`${Math.floor(s/60)} мин ${s%60} с`:`${s} с`;};
  const views={setup:$("#setup-view"),quiz:$("#quiz-view"),result:$("#result-view")};
  let selectedBank="theory", selectedMode="study", session=null, lastResult=null;
  const visible = name => {
    for (const [key,node] of Object.entries(views)) node.hidden=key!==name;
    $("#home-btn").hidden=name==="setup";
    window.scrollTo({top:0,behavior:"instant"});
    $("#main-content").focus({preventScroll:true});
  };
  const getPool = id => id==="mixed" ? allQuestions : (banks.find(bank=>bank.id===id)?.questions||[]);
  const bankTitle = s => s.bankId==="mixed" ? "ОБА ТЕСТА" : s.bankId==="mistakes" ? "РАБОТА НАД ОШИБКАМИ" : s.bankId==="theory" ? "ТЕОРИЯ / 27" : "КЕЙС KOKSHE / 21";
  const sessionValid = s => !!(s && Array.isArray(s.ids) && s.ids.length>0 && s.ids.length<=48
    && new Set(s.ids).size===s.ids.length && s.ids.every(id=>byId.has(id))
    && Number.isInteger(s.index) && s.index>=0 && s.index<s.ids.length
    && ["study","exam"].includes(s.mode) && s.answers && typeof s.answers==="object"
    && s.optionMaps && typeof s.optionMaps==="object"
    && s.ids.every(id=>Array.isArray(s.optionMaps[id]) && s.optionMaps[id].length===4
      && new Set(s.optionMaps[id]).size===4 && s.optionMaps[id].every(n=>[0,1,2,3].includes(n)))
    && Object.entries(s.answers).every(([id,index])=>s.ids.includes(id)&&Number.isInteger(index)&&index>=0&&index<4));
  const answersCount = s => Object.keys(s.answers).length;
  const correctCount = s => s.ids.filter(id=>s.answers[id]===byId.get(id).correct).length;
  const errorIds = s => s.ids.filter(id=>s.answers[id]!==byId.get(id).correct);
  const renderBanks = () => {
    const pool=[{id:"theory",num:"01",name:"Теория и задачи",detail:"27 вопросов · русский"},{id:"case",num:"02",name:"RK_1_CASE · Kokshe",detail:"21 вопрос · English"},{id:"mixed",num:"03",name:"Полная подготовка",detail:"48 вопросов · оба теста"}];
    $("#bank-grid").innerHTML=pool.map(b=>`<button type="button" class="bank-card ${selectedBank===b.id?"selected":""}" data-bank="${b.id}" aria-pressed="${selectedBank===b.id}">
      <span class="bank-card-top"><span class="bank-card-id">${b.num} / TEST</span><span class="bank-check" aria-hidden="true">${selectedBank===b.id?"✓":""}</span></span>
      <span class="bank-name">${escapeHtml(b.name)}</span><span class="bank-subtitle">${b.detail}</span>
    </button>`).join("");
    $$(".bank-card").forEach(button=>button.addEventListener("click",()=>{selectedBank=button.dataset.bank;renderBanks();}));
  };
  const renderModes=()=>{
    $$(".mode-button").forEach(button=>{const on=button.dataset.mode===selectedMode;button.classList.toggle("selected",on);button.setAttribute("aria-pressed",String(on));});
    $("#mode-description").textContent=selectedMode==="study"?"Сразу показываем ответ и объяснение":"Правильные ответы — только после завершения";
  };
  const updateResume = () => {
    const s=readStore(SAVED_SESSION);
    const button=$("#resume-btn");
    button.hidden=!sessionValid(s);
    if(!button.hidden) button.textContent=`Продолжить · ${s.index+1} из ${s.ids.length}`;
  };
  const renderSetup=()=>{renderBanks();renderModes();updateResume();visible("setup");};
  const saveSession=()=>{if(session)saveStore(SAVED_SESSION,session);};
  const createSession=(bankId,mode,idsOverride)=>{
    const ids=idsOverride||getPool(bankId).map(q=>q.id);
    const questionShuffle=$("#shuffle-questions").checked;
    const optionShuffle=$("#shuffle-options").checked;
    const ordered=questionShuffle?shuffleArray(ids):[...ids];
    const optionMaps=Object.fromEntries(ordered.map(id=>[id,optionShuffle?shuffleArray([0,1,2,3]):[0,1,2,3]]));
    return {version:1,bankId,mode,ids:ordered,index:0,answers:{},optionMaps,startedAt:Date.now()};
  };
  const start = (bankId=selectedBank,mode=selectedMode,ids=null) => {
    session=createSession(bankId,mode,ids);
    saveSession();
    renderQuestion();
  };
  const renderQuestion=()=>{
    if(!sessionValid(session)){dropStore(SAVED_SESSION);renderSetup();return;}
    const s=session,q=byId.get(s.ids[s.index]);
    const responded=Object.prototype.hasOwnProperty.call(s.answers,q.id);
    const picked=s.answers[q.id],isStudy=s.mode==="study";
    const reveal=isStudy && responded;
    $("#quiz-bank-label").textContent=bankTitle(s);
    $("#question-index").textContent=s.index+1;
    $("#question-total").textContent=s.ids.length;
    $("#question-text").textContent=q.question;
    $("#question-kind").textContent=q.id.startsWith("T")?"ТЕОРИЯ + ПРАКТИКА":"KOKSHE CASE";
    $("#quiz-mode-label").textContent=isStudy?"РЕЖИМ ОБУЧЕНИЯ":"ЭКЗАМЕН · БЕЗ ПОДСКАЗОК";
    $("#question-help").textContent=isStudy?"Выбери один вариант. Затем увидишь объяснение.":"Выбери ответ — правильность увидишь в конце.";
    const percent=Math.round(s.index/s.ids.length*100);
    $("#progress-fill").style.width=`${percent}%`;
    $("#question-progress").setAttribute("aria-valuenow",String(percent));
    $("#answers").innerHTML=s.optionMaps[q.id].map((originalIndex,displayIndex)=>{
      const selected=responded && picked===originalIndex;
      const correct=reveal && q.correct===originalIndex;
      const incorrect=reveal && selected && q.correct!==originalIndex;
      const cls=[selected?"selected":"",correct?"correct":"",incorrect?"incorrect":""].join(" ");
      return `<button type="button" class="answer ${cls}" data-choice="${originalIndex}" ${reveal?"disabled":""} aria-pressed="${selected}">
        <span class="answer-number" aria-hidden="true">${displayIndex+1}</span>
        <span class="answer-text">${escapeHtml(q.options[originalIndex])}</span>
      </button>`;
    }).join("");
    $$(".answer").forEach(button=>button.addEventListener("click",()=>selectAnswer(Number(button.dataset.choice))));
    const feedback=$("#feedback");
    feedback.hidden=!reveal;
    feedback.className="feedback"+(reveal&&picked!==q.correct?" is-wrong":"");
    if(reveal){
      feedback.innerHTML=`<strong class="feedback-title">${picked===q.correct?"Верно.":"Не совсем. Правильный ответ: "+escapeHtml(q.options[q.correct])}</strong>
        <p>${escapeHtml(q.explanation)}</p>
        ${q.verification==="source"?'<span class="source-note">Важно: ответ отмечен на скриншоте Kahoot; полной финансовой таблицы кейса нет.</span>':""}`;
    }else feedback.textContent="";
    const next=$("#next-btn");
    next.disabled=!responded;
    next.innerHTML=`${s.index===s.ids.length-1?"Завершить тест":"Следующий вопрос"} <span aria-hidden="true">→</span>`;
    $("#sidebar-answered").innerHTML=`${answersCount(s)}<span> / ${s.ids.length}</span>`;
    $("#sidebar-correct").textContent=isStudy?String(correctCount(s)):"—";
    $("#sidebar-wrong").textContent=isStudy?String(answersCount(s)-correctCount(s)):"—";
    $("#side-tip").textContent=q.verification==="source"?"В кейсе нет исходной таблицы. Отмеченный ответ виден на скриншоте, но независимый расчёт не всегда возможен.":"Сначала определи, что спрашивается, затем вспомни формулу и подставь данные.";
    if (views.quiz.hidden) visible("quiz");
  };
  const selectAnswer=index=>{
    if(!session||![0,1,2,3].includes(index))return;
    const q=byId.get(session.ids[session.index]);
    if(session.mode==="study"&&Object.prototype.hasOwnProperty.call(session.answers,q.id))return;
    session.answers[q.id]=index;
    saveSession();renderQuestion();
  };
  const next=()=>{
    if(!session)return;
    const id=session.ids[session.index];
    if(!Object.prototype.hasOwnProperty.call(session.answers,id))return;
    if(session.index===session.ids.length-1){finish();return;}
    session.index++;
    saveSession();renderQuestion();
  };
  const finish=()=>{
    if(!session)return;
    const s=session;lastResult=JSON.parse(JSON.stringify(s));
    const correct=correctCount(s),wrong=errorIds(s),percent=Math.round(100*correct/s.ids.length);
    const duration=Math.max(0,Date.now()-s.startedAt);
    const prevScores=readStore(SAVED_SCORES)||{};
    const key=`${s.bankId}:${s.mode}`;
    prevScores[key]={score:correct,total:s.ids.length,date:new Date().toISOString()};
    saveStore(SAVED_SCORES,prevScores);
    session=null;dropStore(SAVED_SESSION);
    $("#score-number").textContent=`${percent}%`;
    $("#score-ring").style.setProperty("--score",`${percent}%`);
    $("#result-right").textContent=correct;
    $("#result-wrong").textContent=wrong.length;
    $("#result-time").textContent=formatTime(duration);
    $("#result-caption").textContent=`${bankTitle(s)} · ${s.ids.length} вопросов. ${wrong.length?"Разбери ошибки и попробуй ещё раз.":"Все ответы верные. Можно переходить к следующему тесту."}`;
    $("#retry-errors").hidden=wrong.length===0;
    $("#retry-errors").textContent=`Повторить ошибки (${wrong.length}) ↗`;
    const reviews=wrong.map(id=>{
      const q=byId.get(id),picked=s.answers[id];
      return `<article class="review-item"><p class="review-question">${escapeHtml(q.question)}</p>
        <p class="review-answer bad"><b>Твой ответ:</b> ${escapeHtml(q.options[picked])}</p>
        <p class="review-answer"><b>Верно:</b> ${escapeHtml(q.options[q.correct])}</p>
        <p class="review-explanation">${escapeHtml(q.explanation)}</p></article>`;
    });
    $("#review-list").innerHTML=reviews.length?reviews.join(""):'<div class="all-correct">Без ошибок. Все вопросы этой сессии отвечены правильно.</div>';
    visible("result");
  };
  $("#start-btn").addEventListener("click",()=>start());
  $("#resume-btn").addEventListener("click",()=>{const s=readStore(SAVED_SESSION);if(sessionValid(s)){session=s;renderQuestion();}else updateResume();});
  $("#next-btn").addEventListener("click",next);
  $("#exit-btn").addEventListener("click",()=>{saveSession();renderSetup();});
  $("#home-btn").addEventListener("click",()=>{if(session)saveSession();renderSetup();});
  $("#brand-link").addEventListener("click",e=>{e.preventDefault();if(session)saveSession();renderSetup();});
  $("#retry-errors").addEventListener("click",()=>{
    if(!lastResult)return;
    const errors=errorIds(lastResult);
    if(!errors.length)return;
    selectedMode="study";
    start("mistakes","study",errors);
  });
  $("#new-test").addEventListener("click",()=>{lastResult=null;renderSetup();});
  $$(".mode-button").forEach(b=>b.addEventListener("click",()=>{selectedMode=b.dataset.mode;renderModes();}));
  document.addEventListener("keydown",event=>{
    if(views.quiz.hidden||event.altKey||event.ctrlKey||event.metaKey||event.repeat||/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName||""))return;
    if(["1","2","3","4"].includes(event.key)){
      const option=$$("#answers .answer")[Number(event.key)-1];
      if(option&&!option.disabled){event.preventDefault();option.click();}
    }else if(event.key==="Enter"&&document.activeElement===document.body&&!$("#next-btn").disabled){event.preventDefault();next();}
  });
  if(!banks.length||allQuestions.length!==48||new Set(allQuestions.map(q=>q.id)).size!==48){
    $("#bank-grid").textContent="Не удалось загрузить вопросы. Обновите страницу.";
    $("#start-btn").disabled=true;
  }
  renderSetup();
})();
