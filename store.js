/* Local-only demo data store for Novel co-creation. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NovelStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var DATA_KEY = 'novel-co-creation:data:v1';
  var DRAFT_KEY = 'novel-co-creation:drafts:v1';
  var DEMO_USER = { id: 'local-demo-user', username: 'demo_writer', displayName: '演示作者', avatar: '' };

  function fail(message) { throw new Error(message); }
  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }
  function storage() {
    try {
      if (!root || !root.localStorage) fail('当前环境不支持本地存储');
      return root.localStorage;
    } catch (e) {
      if (e instanceof Error && e.message === '当前环境不支持本地存储') throw e;
      fail('无法访问本地存储');
    }
  }
  function id(prefix) {
    var random = '';
    try {
      if (root.crypto && typeof root.crypto.randomUUID === 'function') random = root.crypto.randomUUID();
    } catch (_) { /* use fallback */ }
    if (!random) random = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
    return prefix + '-' + random;
  }
  function now() { return new Date().toISOString(); }
  function isText(value) { return typeof value === 'string'; }
  function validateStateShape(state) {
    function invalid() { fail('本地作品数据格式无效'); }
    if (!state || state.version !== 1 || !Array.isArray(state.novels)) invalid();
    state.novels.forEach(function (novel) {
      if (!novel || !isText(novel.id) || !isText(novel.title) || !Array.isArray(novel.branches)) invalid();
      novel.branches.forEach(function (branch) {
        if (!branch || !isText(branch.id) || !isText(branch.name) || !isText(branch.head) || !Array.isArray(branch.chapters)) invalid();
        branch.chapters.forEach(function (chapter) {
          if (!chapter || !isText(chapter.id) || !(chapter.parentId === null || isText(chapter.parentId)) || !isText(chapter.title) || !isText(chapter.body) || !Array.isArray(chapter.revisions)) invalid();
          chapter.revisions.forEach(function (revision) {
            if (!revision || !isText(revision.id) || !isText(revision.title) || !isText(revision.body) || !isText(revision.createdAt)) invalid();
          });
        });
      });
    });
    return state;
  }

  function demoState() {
    var time = now();
    var firstId = 'demo-chapter-1';
    var secondId = 'demo-chapter-2';
    var firstRev = { id: 'demo-revision-1', title: '雨夜来信', body: '雨落在旧车站的玻璃顶上。林遥在末班车开走前，收到一封没有署名的信。', author: clone(DEMO_USER), createdAt: time, message: '写下开篇' };
    var secondRev = { id: 'demo-revision-2', title: '没有署名的信', body: '信里只有一句话：天亮以前，不要回家。林遥抬头时，站台尽头亮起一盏不该存在的灯。', author: clone(DEMO_USER), createdAt: time, message: '接续故事' };
    var chapters = [
      { id: firstId, parentId: null, title: firstRev.title, body: firstRev.body, author: clone(DEMO_USER), createdAt: time, revisions: [firstRev] },
      { id: secondId, parentId: firstId, title: secondRev.title, body: secondRev.body, author: clone(DEMO_USER), createdAt: time, revisions: [secondRev] }
    ];
    var branch = { id: 'demo-branch-main', name: 'main', head: 'demo-commit-2', chapters: chapters };
    return { version: 1, novels: [{ id: 'demo-novel', title: '末班车之后', description: '一封来信让林遥错过了回家的末班车。', rules: '沿用已有设定；每次提交保留自己的故事路线。', createdAt: time, updatedAt: time, owner: clone(DEMO_USER), branches: [branch] }] };
  }
  function readState() {
    var s = storage();
    var raw;
    try { raw = s.getItem(DATA_KEY); } catch (_) { fail('读取本地作品失败'); }
    if (raw === null) {
      var initial = demoState();
      writeRaw(DATA_KEY, initial);
      return initial;
    }
    try {
      var parsed = JSON.parse(raw);
      return validateStateShape(parsed);
    } catch (e) {
      if (e instanceof Error && e.message === '本地作品数据格式无效') throw e;
      fail('本地作品数据已损坏，无法读取');
    }
  }
  function writeRaw(key, value) {
    var s = storage();
    var raw;
    try { raw = JSON.stringify(value); } catch (_) { fail('无法序列化本地数据'); }
    try { s.setItem(key, raw); } catch (_) { fail('本地存储失败，可能空间不足'); }
    try {
      if (s.getItem(key) !== raw) fail('本地存储未能确认写入');
    } catch (e) {
      if (e instanceof Error && e.message === '本地存储未能确认写入') throw e;
      fail('无法确认本地数据已写入');
    }
  }
  function commitState(state) { writeRaw(DATA_KEY, state); }
  function getNovelRef(state, novelId) { return state.novels.find(function (n) { return n.id === novelId; }) || null; }
  function getBranchRef(novel, branchId) { return novel && novel.branches.find(function (b) { return b.id === branchId; }) || null; }
  function validateHead(branch, expectedHead) {
    if (expectedHead !== branch.head) fail('作品已被其他标签页更新，请重新载入后再试');
  }
  function requiredText(value, label) {
    if (typeof value !== 'string' || !value.trim()) fail(label + '不能为空');
    return value.trim();
  }
  function branchSummary(branch) { return { id: branch.id, name: branch.name, head: branch.head }; }
  function novelView(novel) {
    var out = clone(novel);
    out.branches = novel.branches.map(branchSummary);
    return out;
  }
  function lineage(branch, chapterId) {
    var index = chapterId === null ? -1 : branch.chapters.findIndex(function (c) { return c.id === chapterId; });
    if (chapterId !== null && index < 0) fail('所选章节不在来源分支中');
    return branch.chapters.slice(0, index + 1);
  }
  function branchView(branch) {
    var out = clone(branch);
    out.chapters = clone(branch.chapters);
    return out;
  }
  function requireNovelBranch(novelId, branchId, state) {
    var novel = getNovelRef(state, novelId);
    if (!novel) fail('找不到这部作品');
    var branch = getBranchRef(novel, branchId);
    if (!branch) fail('找不到这条分支');
    return { novel: novel, branch: branch };
  }
  function draftMap() {
    var s = storage();
    var raw;
    try { raw = s.getItem(DRAFT_KEY); } catch (_) { fail('读取本地草稿失败'); }
    if (raw === null) return {};
    try {
      var map = JSON.parse(raw);
      if (!map || typeof map !== 'object' || Array.isArray(map)) fail('本地草稿数据格式无效');
      return map;
    } catch (e) {
      if (e instanceof Error && e.message === '本地草稿数据格式无效') throw e;
      fail('本地草稿数据已损坏，无法读取');
    }
  }
  function draftKey(novelId, branchId, chapterId) { return JSON.stringify([novelId, branchId, chapterId == null ? null : chapterId]); }
  function normalizeDraftArgs(chapterId, draft) {
    if (draft === undefined && chapterId && typeof chapterId === 'object') return { chapterId: null, draft: chapterId };
    return { chapterId: chapterId == null ? null : chapterId, draft: draft };
  }

  var api = {
    listNovels: function () { return readState().novels.map(novelView); },
    getNovel: function (novelId) { var n = getNovelRef(readState(), novelId); return n ? novelView(n) : null; },
    createNovel: function (input) {
      if (!input || typeof input !== 'object') fail('作品信息无效');
      var title = requiredText(input.title, '作品标题');
      var state = readState();
      var time = now();
      var branch = { id: id('branch'), name: 'main', head: id('commit'), fromBranchId: null, fromChapterId: null, createdAt: time, chapters: [] };
      var novel = { id: id('novel'), title: title, description: typeof input.description === 'string' ? input.description : '', rules: typeof input.rules === 'string' ? input.rules : '', createdAt: time, updatedAt: time, owner: clone(DEMO_USER), branches: [branch] };
      state.novels.push(novel);
      commitState(state);
      return novelView(novel);
    },
    getBranch: function (novelId, branchId) {
      var state = readState();
      var novel = getNovelRef(state, novelId);
      var branch = getBranchRef(novel, branchId);
      return branch ? branchView(branch) : null;
    },
    createBranch: function (novelId, input) {
      if (!input || typeof input !== 'object') fail('分支信息无效');
      var name = requiredText(input.name, '分支名称');
      var state = readState();
      var found = requireNovelBranch(novelId, input.fromBranchId, state);
      validateHead(found.branch, input.expectedHead);
      if (found.novel.branches.some(function (b) { return b.name.toLocaleLowerCase() === name.toLocaleLowerCase(); })) fail('分支名称已存在');
      var path = lineage(found.branch, input.fromChapterId == null ? null : input.fromChapterId);
      var branch = { id: id('branch'), name: name, head: id('commit'), fromBranchId: found.branch.id, fromChapterId: input.fromChapterId == null ? null : input.fromChapterId, createdAt: now(), chapters: clone(path) };
      found.novel.branches.push(branch);
      found.novel.updatedAt = now();
      commitState(state);
      return branchView(branch);
    },
    saveChapter: function (novelId, branchId, input) {
      if (!input || typeof input !== 'object') fail('章节内容无效');
      var title = requiredText(input.title, '章节标题');
      if (typeof input.body !== 'string') fail('章节正文必须是文字');
      var state = readState();
      var found = requireNovelBranch(novelId, branchId, state);
      validateHead(found.branch, input.expectedHead);
      var branch = found.branch;
      var time = now();
      var chapter;
      var revision = { id: id('revision'), title: title, body: input.body, author: clone(DEMO_USER), createdAt: time, message: typeof input.message === 'string' ? input.message : '' };
      if (input.chapterId == null) {
        chapter = { id: id('chapter'), parentId: branch.chapters.length ? branch.chapters[branch.chapters.length - 1].id : null, title: title, body: input.body, author: clone(DEMO_USER), createdAt: time, revisions: [revision] };
        branch.chapters.push(chapter);
      } else {
        var index = branch.chapters.findIndex(function (c) { return c.id === input.chapterId; });
        if (index < 0) fail('要修订的章节不在当前分支中');
        chapter = branch.chapters[index];
        chapter.revisions.push(revision);
        chapter.title = title;
        chapter.body = input.body;
        chapter.author = clone(DEMO_USER);
      }
      branch.head = id('commit');
      found.novel.updatedAt = time;
      commitState(state);
      return clone(chapter);
    },
    getDraft: function (novelId, branchId, chapterId) {
      var map = draftMap();
      var key = draftKey(novelId, branchId, chapterId);
      return Object.prototype.hasOwnProperty.call(map, key) ? clone(map[key]) : null;
    },
    saveDraft: function (novelId, branchId, chapterId, draft) {
      var args = normalizeDraftArgs(chapterId, draft);
      if (!args.draft || typeof args.draft !== 'object' || Array.isArray(args.draft)) fail('草稿内容无效');
      var state = readState();
      var found = requireNovelBranch(novelId, branchId, state);
      if (args.chapterId != null && !found.branch.chapters.some(function (c) { return c.id === args.chapterId; })) fail('草稿对应的章节不在当前分支中');
      var map = draftMap();
      var value = clone(args.draft);
      value.novelId = novelId;
      value.branchId = branchId;
      value.chapterId = args.chapterId;
      value.updatedAt = now();
      map[draftKey(novelId, branchId, args.chapterId)] = value;
      writeRaw(DRAFT_KEY, map);
      return clone(value);
    },
    deleteDraft: function (novelId, branchId, chapterId) {
      var map = draftMap();
      var key = draftKey(novelId, branchId, chapterId);
      delete map[key];
      writeRaw(DRAFT_KEY, map);
      return true;
    },
    exportNovel: function (novelId) {
      var novel = getNovelRef(readState(), novelId);
      if (!novel) fail('找不到这部作品');
      return clone(novel);
    },
    getUser: function () { return clone(DEMO_USER); }
  };
  return api;
});
