const test = require('node:test');
const assert = require('node:assert/strict');

class MemoryStorage {
  constructor() { this.data = new Map(); this.failWrites = false; }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) {
    if (this.failWrites) throw new Error('quota');
    this.data.set(key, String(value));
  }
  removeItem(key) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

global.localStorage = new MemoryStorage();
const NovelStore = require('../store.js');

function setup() {
  global.localStorage.clear();
  const novel = NovelStore.getNovel('demo-novel');
  const branch = novel.branches[0];
  return { novel, branch, firstId: 'demo-chapter-1', secondId: 'demo-chapter-2' };
}

test('branch from a chapter has only that route and edits stay isolated', () => {
  const { novel, branch, firstId, secondId } = setup();
  const fork = NovelStore.createBranch(novel.id, {
    name: '另一条路', fromBranchId: branch.id, fromChapterId: firstId, expectedHead: branch.head
  });
  assert.equal(fork.chapters.length, 1);
  assert.equal(fork.chapters[0].id, firstId);
  const oldHead = branch.head;
  const revised = NovelStore.saveChapter(novel.id, branch.id, {
    chapterId: firstId, title: '雨夜来信（修订）', body: '新正文', message: '改写开篇', expectedHead: oldHead
  });
  assert.equal(revised.revisions.length, 2);
  assert.notEqual(NovelStore.getBranch(novel.id, branch.id).head, oldHead);
  assert.equal(NovelStore.getBranch(novel.id, fork.id).chapters[0].body, '雨落在旧车站的玻璃顶上。林遥在末班车开走前，收到一封没有署名的信。');
  assert.equal(NovelStore.getBranch(novel.id, branch.id).chapters.find(c => c.id === secondId).parentId, firstId);
});

test('stable chapter IDs and immutable revisions are preserved', () => {
  const { novel, branch, firstId } = setup();
  const updated = NovelStore.saveChapter(novel.id, branch.id, {
    chapterId: firstId, title: '新标题', body: '改写后的正文', message: '修订', expectedHead: branch.head
  });
  assert.equal(updated.id, firstId);
  assert.equal(updated.revisions.length, 2);
  assert.equal(updated.revisions[0].title, '雨夜来信');
  assert.notEqual(updated.revisions[0].body, updated.body);
  assert.notEqual(updated.revisions[1].id, updated.revisions[0].id);
});

test('stale editor cannot overwrite a committed chapter revision', () => {
  const { novel, branch, firstId } = setup();
  const staleHead = branch.head;
  NovelStore.saveChapter(novel.id, branch.id, {
    chapterId: firstId, title: '编辑器甲', body: '甲的内容', expectedHead: staleHead
  });
  const before = NovelStore.exportNovel(novel.id);
  assert.throws(() => NovelStore.saveChapter(novel.id, branch.id, {
    chapterId: firstId, title: '编辑器乙', body: '乙的内容', expectedHead: staleHead
  }), /其他标签页更新/);
  assert.deepEqual(NovelStore.exportNovel(novel.id), before);
});

test('drafts persist independently and can be recovered and deleted', () => {
  const { novel, branch, firstId } = setup();
  const draft = NovelStore.saveDraft(novel.id, branch.id, firstId, { title: '未提交', body: '本地草稿' });
  assert.equal(NovelStore.getDraft(novel.id, branch.id, firstId).body, '本地草稿');
  assert.ok(draft.updatedAt);
  assert.equal(NovelStore.getBranch(novel.id, branch.id).chapters[0].body, '雨落在旧车站的玻璃顶上。林遥在末班车开走前，收到一封没有署名的信。');
  assert.equal(NovelStore.deleteDraft(novel.id, branch.id, firstId), true);
  assert.equal(NovelStore.getDraft(novel.id, branch.id, firstId), null);
});

test('failed persistence throws and leaves stored state untouched', () => {
  const { novel } = setup();
  const before = global.localStorage.getItem('novel-co-creation:data:v1');
  global.localStorage.failWrites = true;
  assert.throws(() => NovelStore.createNovel({ title: '不应写入' }), /本地存储失败/);
  assert.equal(global.localStorage.getItem('novel-co-creation:data:v1'), before);
  global.localStorage.failWrites = false;
  assert.equal(NovelStore.getNovel(novel.id).title, '末班车之后');
});

test('new novels start with an empty main branch and appended chapters link by stable IDs', () => {
  global.localStorage.clear();
  const novel = NovelStore.createNovel({ title: '新作品' });
  const main = NovelStore.getBranch(novel.id, novel.branches[0].id);
  assert.equal(main.name, 'main');
  assert.equal(main.chapters.length, 0);
  assert.ok(main.head);
  const first = NovelStore.saveChapter(novel.id, main.id, { title: '第一章', body: '一', expectedHead: main.head });
  const afterFirst = NovelStore.getBranch(novel.id, main.id);
  const second = NovelStore.saveChapter(novel.id, main.id, { title: '第二章', body: '二', expectedHead: afterFirst.head });
  assert.ok(first.id);
  assert.notEqual(first.id, second.id);
  assert.equal(second.parentId, first.id);
  const route = NovelStore.getBranch(novel.id, main.id);
  assert.deepEqual(route.chapters.map(c => c.id), [first.id, second.id]);
});

test('a branch can fork from another branch and keeps its own chapter snapshots', () => {
  const { novel, branch, firstId } = setup();
  const firstFork = NovelStore.createBranch(novel.id, {
    name: '分支甲', fromBranchId: branch.id, fromChapterId: firstId, expectedHead: branch.head
  });
  const forkChapter = NovelStore.saveChapter(novel.id, firstFork.id, {
    title: '分支续章', body: '分支甲的后续', expectedHead: firstFork.head
  });
  const forkHead = NovelStore.getBranch(novel.id, firstFork.id).head;
  const secondFork = NovelStore.createBranch(novel.id, {
    name: '分支乙', fromBranchId: firstFork.id, fromChapterId: forkChapter.id, expectedHead: forkHead
  });
  assert.deepEqual(secondFork.chapters.map(c => c.id), [firstId, forkChapter.id]);

  const oldForkBody = NovelStore.getBranch(novel.id, secondFork.id).chapters[0].body;
  NovelStore.saveChapter(novel.id, firstFork.id, {
    chapterId: firstId, title: '甲线修订', body: '只在甲线可见', expectedHead: forkHead
  });
  assert.equal(NovelStore.getBranch(novel.id, firstFork.id).chapters[0].body, '只在甲线可见');
  assert.equal(NovelStore.getBranch(novel.id, secondFork.id).chapters[0].body, oldForkBody);
  assert.notEqual(NovelStore.getBranch(novel.id, branch.id).chapters[0].body, '只在甲线可见');
});

test('mutating values returned by read and export methods does not change stored data', () => {
  const { novel, branch, firstId } = setup();
  const listed = NovelStore.listNovels();
  const fetched = NovelStore.getNovel(novel.id);
  const branchData = NovelStore.getBranch(novel.id, branch.id);
  const exported = NovelStore.exportNovel(novel.id);
  listed[0].title = '外部修改';
  fetched.branches[0].name = '外部修改';
  branchData.chapters[0].body = '外部修改';
  exported.branches[0].chapters[0].revisions[0].body = '外部修改';
  assert.equal(NovelStore.getNovel(novel.id).title, '末班车之后');
  assert.equal(NovelStore.getBranch(novel.id, branch.id).chapters[0].id, firstId);
  assert.notEqual(NovelStore.getBranch(novel.id, branch.id).chapters[0].body, '外部修改');
  assert.notEqual(NovelStore.exportNovel(novel.id).branches[0].chapters[0].revisions[0].body, '外部修改');
});

test('duplicate branch names and empty titles fail without writing', () => {
  const { novel, branch, firstId } = setup();
  const before = global.localStorage.getItem('novel-co-creation:data:v1');
  assert.throws(() => NovelStore.createBranch(novel.id, {
    name: 'MAIN', fromBranchId: branch.id, fromChapterId: firstId, expectedHead: branch.head
  }), /分支名称已存在/);
  assert.equal(global.localStorage.getItem('novel-co-creation:data:v1'), before);
  assert.throws(() => NovelStore.createNovel({ title: '   ' }), /作品标题不能为空/);
  assert.equal(global.localStorage.getItem('novel-co-creation:data:v1'), before);
  assert.throws(() => NovelStore.saveChapter(novel.id, branch.id, {
    title: '', body: '正文', expectedHead: branch.head
  }), /章节标题不能为空/);
  assert.equal(global.localStorage.getItem('novel-co-creation:data:v1'), before);
});

test('corrupt or malformed stored JSON is reported and never reset', () => {
  global.localStorage.clear();
  const corrupt = '{this is not json';
  global.localStorage.setItem('novel-co-creation:data:v1', corrupt);
  assert.throws(() => NovelStore.listNovels(), /本地作品数据已损坏/);
  assert.equal(global.localStorage.getItem('novel-co-creation:data:v1'), corrupt);
  const malformed = JSON.stringify({ version: 1, novels: [{ id: 'broken', branches: {} }] });
  global.localStorage.setItem('novel-co-creation:data:v1', malformed);
  assert.throws(() => NovelStore.listNovels(), /本地作品数据格式无效/);
  assert.equal(global.localStorage.getItem('novel-co-creation:data:v1'), malformed);
});
