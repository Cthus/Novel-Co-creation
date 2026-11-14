(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s),
    qs = new URLSearchParams(location.search),
    page = document.body.dataset.page;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const url = (file, params = {}) =>
    file +
    "?" +
    new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
    ).toString();
  const stamp = (x) =>
    x
      ? new Date(x).toLocaleString("zh-CN", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "时间未知";
  let noticeTimer;
  function toast(s) {
    let n = $("#toast");
    if (!n) {
      n = document.createElement("div");
      n.id = "toast";
      n.className = "toast";
      n.setAttribute("role", "status");
      document.body.append(n);
    }
    n.textContent = s;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => n.remove(), 4000);
  }
  function shell(title, content) {
    const user = window.NovelStore?.getUser?.();
    document.body.innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="brand" href="start.html"><span class="brand-mark">文</span><span>共创书房</span></a><button class="mobile-menu" aria-label="打开导航" id="menuBtn">☰</button><nav class="side-nav"><a href="start.html" class="${page === "start" ? "active" : ""}">⌂　书房首页</a><a href="main.html" class="${page === "main" ? "active" : ""}">▤　我的作品</a><a href="new.html" class="${page === "new" ? "active" : ""}">＋　创建作品</a><a href="signin.html">◉　本地身份说明</a></nav><div class="side-note">作品仅保存在当前浏览器<br>本地演示 · 尚未连接云端</div></aside><main class="main-area"><header class="topbar"><span class="crumb">${esc(title)}</span><span class="user-chip">本地演示 · ${esc(user?.displayName || user?.name || "访客")}</span></header><div class="content">${content}</div></main></div>`;
    $("#menuBtn").setAttribute("aria-expanded", "false");
    $("#menuBtn").addEventListener("click", () => {
      const open = $(".sidebar").classList.toggle("open");
      $("#menuBtn").setAttribute("aria-expanded", String(open));
      $("#menuBtn").setAttribute("aria-label", open ? "关闭导航" : "打开导航");
    });
  }
  function store() {
    if (!window.NovelStore)
      throw Error("数据层尚未加载，请确认 store.js 与页面位于同一目录。");
    return window.NovelStore;
  }
  function missing() {
    shell(
      "找不到作品",
      `<div class="empty"><h2>这条故事路线暂时不可用</h2><p>链接中的作品、分支或章节可能已不存在。</p><a class="btn primary" href="main.html">回到作品列表</a></div>`,
    );
  }
  function init() {
    try {
      if (page === "signin") return signin();
      if (page === "new") return createPage();
      if (page === "start" || page === "main") return listing(page === "start");
      if (page === "read" || page === "edit") return reader(page);
    } catch (e) {
      shell(
        "本地保存不可用",
        `<div class="notice error">${esc(e.message || "发生错误")}</div><a class="btn" href="main.html">回作品列表</a>`,
      );
    }
  }
  function signin() {
    shell(
      "本地演示身份",
      `<div class="login-box"><div class="brand login-brand"><span class="brand-mark">文</span><span>共创书房</span></div><div class="eyebrow">身份与存储</div><h1 class="page-title">本地演示空间</h1><p class="lead">这里使用浏览器内的演示身份，数据只存在本机当前浏览器。</p><section class="card"><h2>尚未接入 GitHub 登录</h2><p class="muted">用户名和身份仅用于本地标记，不会验证账号，也不会同步到云端。项目邀请、成员权限和远程协作暂未实现。</p><a class="btn primary" href="main.html">继续使用本地书房</a></section><p class="footer-note">如果清除浏览器站点数据，保存在此浏览器的作品和草稿也会被清除。</p></div>`,
    );
  }
  function listing(home) {
    let novels = store().listNovels(),
      u = store().getUser();
    let cards = novels
      .map(
        (n) =>
          `<article class="card novel-card"><span class="eyebrow">作品 · ${esc(n.branches?.length || 0)} 条故事线</span><h2>${esc(n.title)}</h2><p>${esc(n.description || "尚未添加作品简介。")}</p><div class="row between"><span class="muted">更新于 ${esc(stamp(n.updatedAt))}</span><a class="btn small primary" href="${url("read.html", { id: n.id })}">打开作品 →</a></div></article>`,
      )
      .join("");
    shell(
      home ? "书房首页" : "我的作品",
      `<div class="row between"><div><div class="eyebrow">你好，${esc(u?.displayName || u?.name || "创作者")}</div><h1 class="page-title">${home ? "让故事从一个节点继续。" : "我的作品"}</h1><p class="lead">记录章节、修订和不同故事路线。</p></div><a class="btn primary" href="new.html">＋ 创建作品</a></div><div class="row" style="margin-bottom:22px"><div class="card stat"><strong>${novels.length}</strong><span>本作品</span></div><div class="card stat"><strong>${novels.reduce((a, n) => a + (n.branches?.length || 0), 0)}</strong><span>条故事线</span></div></div>${cards ? `<div class="grid novel-grid">${cards}</div>` : `<div class="empty"><h2>你的书房还空着</h2><p>创建一本作品，写下简介与共创规则。</p><a class="btn primary" href="new.html">创建第一本作品</a></div>`}`,
    );
  }
  function createPage() {
    shell(
      "创建作品",
      `<div class="eyebrow">开始一段共创</div><h1 class="page-title">创建新作品</h1><p class="lead">标题、简介和共创规则会保存在本地作品资料中。</p><form class="card form-card" id="createForm"><div class="field"><label for="title">作品标题 <span aria-hidden="true">*</span></label><input id="title" name="title" required maxlength="100" placeholder="例如：雾港来信"></div><div class="field"><label for="description">作品简介</label><textarea id="description" name="description" placeholder="故事发生在哪里？主角正面临什么？"></textarea></div><div class="field"><label for="rules">共创规则</label><textarea id="rules" name="rules" placeholder="约定叙事视角、世界观边界或协作方式"></textarea></div><div class="notice">作品将创建一条空的 main 主线。当前为本地演示，尚未连接 GitHub 或云端。</div><div class="row"><button class="btn primary" type="submit">创建作品</button><a class="btn" href="main.html">取消</a><span id="formError" class="muted" role="status"></span></div></form>`,
    );
    $("#createForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const submit = e.currentTarget.querySelector('button[type="submit"]');
      if (submit.disabled) return;
      submit.disabled = true;
      const f = new FormData(e.currentTarget);
      try {
        const n = store().createNovel({
          title: f.get("title").trim(),
          description: f.get("description").trim(),
          rules: f.get("rules").trim(),
        });
        location.href = url("read.html", { id: n.id });
      } catch (err) {
        submit.disabled = false;
        $("#formError").textContent = err.message;
        toast(err.message);
      }
    });
  }
  function reader(mode) {
    const id = qs.get("id"),
      novel = store().getNovel(id);
    if (!id || !novel) return missing();
    const branches = novel.branches || [];
    let bid = qs.get("branch") || branches[0]?.id;
    if (!bid || !branches.some((b) => b.id === bid)) return missing();
    const branch = store().getBranch(id, bid);
    if (!branch) return missing();
    const chapterId =
      qs.get("chapter") ||
      (mode === "read" ? branch.chapters.at(-1)?.id : undefined);
    const chapter = branch.chapters.find((c) => c.id === chapterId);
    if (chapterId && !chapter) return missing();
    if (mode === "edit") return editor(novel, branch, chapter);
    renderRead(novel, branch, chapter);
    if (qs.get("draftCleanupFailed") === "1")
      toast("章节已提交；旧草稿清理失败，再次编辑时请核对草稿内容。");
  }
  function basePath(n, b, c) {
    return { id: n.id, branch: b.id, chapter: c?.id };
  }
  function branchChoices(n, b) {
    return n.branches
      .map(
        (x) =>
          `<option value="${esc(x.id)}" ${x.id === b.id ? "selected" : ""}>${esc(x.name)}</option>`,
      )
      .join("");
  }
  function renderRead(n, b, c) {
    let chapters = b.chapters;
    const originBranch = b.fromBranchId
      ? n.branches.find((x) => x.id === b.fromBranchId)
      : null;
    const originData = originBranch
      ? store().getBranch(n.id, originBranch.id)
      : null;
    const originChapter = b.fromChapterId
      ? originData?.chapters.find((x) => x.id === b.fromChapterId)
      : null;
    const originLabel = b.fromBranchId
      ? `来源：${originBranch?.name || "原故事线"}${originChapter ? ` · ${originChapter.title}` : " · 空路线起点"}`
      : "来源：作品主线";
    let selectedIndex = chapters.findIndex((x) => x.id === c?.id),
      revisions = c?.revisions || [],
      revIndex = Math.max(
        0,
        Math.min(
          revisions.length - 1,
          Number.parseInt(qs.get("rev") || String(revisions.length - 1), 10) ||
            0,
        ),
      ),
      revision = revisions[revIndex] || c,
      older = c && revIndex > 0;
    const chapterList = chapters
      .map(
        (x, i) =>
          `<a class="chapter-link ${x.id === c?.id ? "selected" : ""}" href="${url("read.html", basePath(n, b, x))}"><span class="chapter-index">第 ${i + 1} 章</span>${esc(x.title)}</a>`,
      )
      .join("");
    const body = c
      ? `<div class="row between"><div><div class="eyebrow">第 ${selectedIndex + 1} 章</div><h2>${esc(revision?.title ?? c.title)}</h2><div class="chapter-meta">${esc(revision?.author?.displayName || c.author?.displayName || "本地作者")} · ${esc(stamp(revision?.createdAt ?? c.createdAt))}</div></div><div class="row"><a class="btn small" href="${url("creat.html", basePath(n, b, c))}">修订章节</a>${selectedIndex === chapters.length - 1 ? `<a class="btn small primary" href="${url("creat.html", { id: n.id, branch: b.id })}">续写下一章</a>` : `<button class="btn small primary" id="branchFromNode">从此节点分支续写</button>`}</div></div><hr class="divider">${revIndex < revisions.length - 1 ? '<div class="notice">正在阅读历史修订；修订与新建分支操作均以该章节的最新修订为起点。</div>' : ""}${revisions.length > 1 ? `<div class="field"><label for="revisionSelect">查看修订版本</label><select id="revisionSelect">${revisions.map((r, i) => `<option value="${i}" ${i === revIndex ? "selected" : ""}>版本 ${i + 1} · ${esc(stamp(r.createdAt))} · ${esc(r.message || "无说明")}</option>`).join("")}</select></div>` : ""}<label class="toggle"><input type="checkbox" id="diffToggle" ${qs.get("diff") === "1" ? "checked" : ""} ${older ? "" : "disabled"}> 显示与上一版的修订差异</label><div id="chapterText" class="chapter-body">${esc(revision?.body ?? c.body)}</div><div id="diffText" class="diff" hidden></div>${older ? `<div class="card" style="margin-top:20px"><div class="row between"><strong>修订记录</strong><a class="btn small" href="${url("read.html", { ...basePath(n, b, c), diff: 1, rev: revIndex })}">查看版本对比</a></div>${c.revisions.map((r, i) => `<div class="chapter-meta">版本 ${i + 1} · ${esc(stamp(r.createdAt))} · ${esc(r.message || "未填写修订说明")}</div>`).join("")}</div>` : ""}`
      : `<div class="empty"><h2>这条故事线尚无章节</h2><p>从空路线开始写下第一章。</p><a class="btn primary" href="${url("creat.html", { id: n.id, branch: b.id })}">写第一章</a></div>`;
    shell(
      n.title,
      `<div class="row between"><div><div class="eyebrow">作品阅读</div><h1 class="page-title">${esc(n.title)}</h1><p class="lead">${esc(n.description || "暂无简介")}</p></div><button class="btn" id="exportBtn">导出 JSON</button></div><div class="row between card" style="margin-bottom:18px"><div><label class="muted" for="branchSelect">故事路线</label><br><select id="branchSelect">${branchChoices(n, b)}</select></div><span class="muted">${esc(originLabel)}</span><button class="btn small" id="branchStart">从此节点另开路线</button></div><div class="eyebrow">路线节点</div><div class="route">${chapters.map((x, i) => `<a class="route-node ${x.id === c?.id ? "active" : ""}" href="${url("read.html", basePath(n, b, x))}"><strong>${esc(x.title)}</strong><span>第 ${i + 1} 章</span></a>`).join("") || '<span class="muted">暂无节点</span>'}</div><div class="book-layout"><aside class="card book-aside"><h3>章节目录</h3><div class="chapter-list">${chapterList || '<span class="muted">尚无章节</span>'}</div><hr class="divider"><h3>作品规则</h3><p class="muted" style="white-space:pre-wrap">${esc(n.rules || "暂无共创规则")}</p></aside><section class="card">${body}</section></div><div id="dialogMount"></div>`,
    );
    $("#branchSelect").addEventListener(
      "change",
      (e) =>
        (location.href = url("read.html", {
          id: n.id,
          branch: e.target.value,
        })),
    );
    $("#revisionSelect")?.addEventListener(
      "change",
      (e) =>
        (location.href = url("read.html", {
          ...basePath(n, b, c),
          rev: e.target.value,
        })),
    );
    $("#exportBtn").addEventListener("click", () => {
      try {
        const data = JSON.stringify(store().exportNovel(n.id), null, 2),
          a = document.createElement("a");
        a.href = URL.createObjectURL(
          new Blob([data], { type: "application/json" }),
        );
        a.download = `${n.title.replace(/[\\/:*?"<>|]/g, "_")}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast("作品 JSON 已导出");
      } catch (e) {
        toast(e.message);
      }
    });
    $("#branchStart").addEventListener("click", () => branchDialog(n, b, c));
    $("#branchFromNode")?.addEventListener("click", () =>
      branchDialog(n, b, c),
    );
    if (c && older) {
      const toggle = $("#diffToggle"),
        render = () => {
          const diff = $("#diffText"),
            normal = $("#chapterText");
          if (toggle.checked) {
            normal.hidden = true;
            diff.hidden = false;
            diff.innerHTML = makeDiff(
              revisions[revIndex - 1]?.body || "",
              revision?.body ?? c.body,
            );
          } else {
            normal.hidden = false;
            diff.hidden = true;
          }
        };
      toggle.addEventListener("change", render);
      if (toggle.checked) render();
    }
  }
  function branchDialog(n, b, c) {
    let name = prompt("新故事线名称：");
    if (name === null) return;
    name = name.trim();
    if (!name) {
      toast("请填写故事线名称");
      return;
    }
    try {
      const created = store().createBranch(n.id, {
        name,
        fromBranchId: b.id,
        fromChapterId: c?.id || null,
        expectedHead: b.head,
      });
      location.href = url("creat.html", { id: n.id, branch: created.id });
    } catch (e) {
      toast(e.message);
    }
  }
  function editor(n, b, c) {
    const chapterId = c?.id,
      draft = store().getDraft(n.id, b.id, chapterId);
    let originalTitle = c?.title || "",
      originalBody = c?.body || "",
      title = originalTitle,
      body = originalBody,
      message = "";
    let conflict = false;
    let draftBase =
      draft && Object.prototype.hasOwnProperty.call(draft, "expectedHead")
        ? draft.expectedHead
        : b.head;
    if (draft) {
      title = draft.title ?? title;
      body = draft.body ?? body;
      message = draft.message || "";
      conflict = draft.expectedHead !== b.head;
    }
    shell(
      c ? "修订章节" : "续写故事",
      `<div class="row between"><div><div class="eyebrow">${c ? "章节修订" : "新章节"}</div><h1 class="page-title">${c ? `修订：${esc(c.title)}` : "继续写下去"}</h1><p class="lead">《${esc(n.title)}》 · ${esc(b.name)}</p></div><a class="btn" href="${url("read.html", basePath(n, b, c))}">返回阅读</a></div><div id="editorNotice">${conflict ? '<div class="notice error">此草稿基于较早的故事线版本。正文已保留。 <button type="button" class="btn small" id="downloadDraft">下载草稿</button> <a class="btn small" href="' + url("read.html", { id: n.id, branch: b.id }) + '">打开最新路线</a> <button type="button" class="btn small" id="acceptLatest">采用当前版本继续</button></div>' : ""}</div><div class="card"><div class="row between"><span class="draft-status" id="draftStatus">${draft ? "已恢复本地草稿" : "本地自动保存已开启"}</span><span class="muted">${c ? "修改仅生成此章节的新修订" : "新章节将接在当前路线末尾"}</span></div><form id="editorForm"><div class="field"><label for="chapterTitle">章节标题 *</label><input id="chapterTitle" required maxlength="160" value="${esc(title)}" placeholder="例如：潮声之后"></div><div class="field"><label for="chapterBody">正文</label><textarea class="editor" id="chapterBody" placeholder="从一个场景、一句话或一个决定开始……">${esc(body)}</textarea></div><div class="field"><label for="message">${c ? "修订说明" : "提交说明"}</label><input id="message" maxlength="180" value="${esc(message)}" placeholder="这次更新了什么？"></div><div class="row"><button class="btn primary" id="submitChapter" type="submit">${c ? "保存修订" : "提交章节"}</button><a class="btn" href="${url("read.html", basePath(n, b, c))}">取消</a><span id="submitError" class="muted" role="status"></span></div></form></div>`,
    );
    const titleEl = $("#chapterTitle"),
      bodyEl = $("#chapterBody"),
      msgEl = $("#message"),
      status = $("#draftStatus"),
      submit = $("#submitChapter");
    let timer = null,
      dirty = false,
      submitted = false;
    function persistDraft() {
      try {
        store().saveDraft(n.id, b.id, chapterId, {
          title: titleEl.value,
          body: bodyEl.value,
          message: msgEl.value,
          expectedHead: draftBase,
          updatedAt: new Date().toISOString(),
        });
        status.textContent = "草稿已保存在此浏览器";
        status.dataset.state = "saved";
        dirty = false;
        return true;
      } catch (e) {
        status.textContent = "草稿未能保存：" + e.message;
        status.dataset.state = "error";
        return false;
      }
    }
    function autosave() {
      dirty = true;
      clearTimeout(timer);
      status.textContent = "正在保存草稿…";
      status.dataset.state = "saving";
      timer = setTimeout(() => {
        timer = null;
        persistDraft();
      }, 350);
    }
    [titleEl, bodyEl, msgEl].forEach((el) =>
      el.addEventListener("input", autosave),
    );
    $("#downloadDraft")?.addEventListener("click", () => {
      const blob = new Blob(
          [
            JSON.stringify(
              {
                title: titleEl.value,
                body: bodyEl.value,
                message: msgEl.value,
                expectedHead: draftBase,
              },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
        a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "本地草稿.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $("#acceptLatest")?.addEventListener("click", () => {
      if (!confirm("以当前故事线版本作为新草稿基准，并保留当前正文？")) return;
      const previousBase = draftBase;
      draftBase = b.head;
      dirty = true;
      if (!persistDraft()) {
        draftBase = previousBase;
        return;
      }
      conflict = false;
      $("#submitError").textContent = "";
      $("#editorNotice").innerHTML =
        '<div class="notice">草稿已保存，并以当前路线版本为基准。提交时仍会检查路线是否再次更新。</div>';
    });
    function flushDraft() {
      if (dirty && !submitted) {
        if (timer) clearTimeout(timer);
        timer = null;
        return persistDraft();
      }
      return true;
    }
    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushDraft();
    });
    window.addEventListener("beforeunload", (e) => {
      if (!flushDraft()) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    $("#editorForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (submit.disabled) return;
      if (conflict) {
        $("#submitError").textContent =
          "草稿基准已过期，请导出正文或打开最新路线后明确采用当前基准。";
        return;
      }
      clearTimeout(timer);
      timer = null;
      submit.disabled = true;
      let saved;
      submitted = true;
      try {
        saved = store().saveChapter(n.id, b.id, {
          ...(chapterId ? { chapterId } : {}),
          title: titleEl.value.trim(),
          body: bodyEl.value,
          message: msgEl.value.trim(),
          expectedHead: draftBase,
        });
      } catch (err) {
        submitted = false;
        submit.disabled = false;
        persistDraft();
        $("#submitError").textContent = err.message;
        toast(err.message);
        return;
      }
      let draftCleanupFailed;
      try {
        store().deleteDraft(n.id, b.id, chapterId);
      } catch (e) {
        draftCleanupFailed = "1";
      }
      location.href = url("read.html", {
        id: n.id,
        branch: b.id,
        chapter: saved.id,
        draftCleanupFailed,
      });
    });
  }
  function makeDiff(oldText, newText) {
    const a = oldText.split(/\n/),
      b = newText.split(/\n/);
    // LCS gives precise line edits for ordinary chapters. For very large drafts,
    // show the entire changed block with a linear prefix/suffix comparison.
    if (a.length * b.length > 180000) {
      let first = 0;
      while (first < a.length && first < b.length && a[first] === b[first])
        first++;
      let tail = 0;
      while (
        tail < a.length - first &&
        tail < b.length - first &&
        a[a.length - 1 - tail] === b[b.length - 1 - tail]
      )
        tail++;
      const out = [...a.slice(0, first).map(esc)];
      if (a.length - first - tail)
        out.push(
          `<del>${esc(a.slice(first, a.length - tail || a.length).join("\n"))}</del>`,
        );
      if (b.length - first - tail)
        out.push(esc(b.slice(first, b.length - tail || b.length).join("\n")));
      if (tail) out.push(...a.slice(a.length - tail).map(esc));
      return out.join("\n");
    }
    const dp = Array.from(
      { length: a.length + 1 },
      () => new Uint32Array(b.length + 1),
    );
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--)
        dp[i][j] =
          a[i] === b[j]
            ? dp[i + 1][j + 1] + 1
            : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const out = [];
    let i = 0,
      j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && a[i] === b[j]) {
        out.push(esc(a[i]));
        i++;
        j++;
      } else if (
        i < a.length &&
        (j === b.length || dp[i + 1][j] >= dp[i][j + 1])
      ) {
        out.push(`<del>${esc(a[i])}</del>`);
        i++;
      } else {
        out.push(esc(b[j]));
        j++;
      }
    }
    return out.join("\n");
  }
  document.addEventListener("DOMContentLoaded", init);
})();
