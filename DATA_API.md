# 本地数据层 API 契约

`store.js` 提供纯浏览器全局对象 `window.NovelStore`，不依赖外部库，可由 HTML 直接通过 `file://` 加载。支持 CommonJS 导出供 Node 测试。所有数据仅保存在当前浏览器的 `localStorage`，是演示实现；不提供真实登录、权限校验、GitHub 同步或跨设备协作。读操作返回深拷贝，调用方修改返回值不会改变存储。

## 方法

- `listNovels()` → `Novel[]`
- `getNovel(id)` → `Novel | null`
- `createNovel({title, description, rules})` → 新建 `Novel`，同时创建空 `main` 分支。标题必填。
- `getBranch(novelId, branchId)` → `Branch | null`。章节按父节点路线从根到最后章节返回；仅包含该分支可见的章节快照。
- `createBranch(novelId, {name, fromBranchId, fromChapterId, expectedHead})` → 新 `Branch`。从指定来源分支的节点创建，仅复制从根到该节点的路线；`fromChapterId: null` 表示空路线。来源头与 `expectedHead` 不匹配时拒绝写入。分支名在作品内不可重复。新分支有自己的不透明 head 版本 ID。
- `saveChapter(novelId, branchId, {chapterId?, title, body, message, expectedHead})` → 更新后的章节节点。无 `chapterId` 时在当前分支最后章节后新增节点；有 ID 时为该节点新增修订。`expectedHead` 必须等于提交前持久化状态的当前 head；不一致时拒绝写入。每次新增或修订都生成新的不透明分支 head 版本 ID，因此修订历史章节也会让 head 前进。改写共享章节时仅本分支产生新的章节快照，其他分支不变。历史修订不可变。
- `getDraft(novelId, branchId, chapterId?)` → 草稿或 `null`
- `saveDraft(novelId, branchId, chapterId?, draft)` → 保存并返回草稿。草稿键独立于正文数据。
- `deleteDraft(novelId, branchId, chapterId?)` → `true`（不存在也成功）
- `exportNovel(novelId)` → 可 JSON 序列化的作品数据深拷贝；不存在时抛错。
- `getUser()` → 本地演示用户对象。

## 数据结构

`Novel = {id,title,description,rules,createdAt,updatedAt,owner,branches}`。`owner` 是演示用户，不代表已验证身份。`branches` 是分支摘要列表，至少含 `{id,name,head}`。

`Branch = {id,name,head,chapters,fromBranchId,fromChapterId,createdAt}`；`head` 是每次新增或修订后都会变化的不透明提交版本 ID，不是章节 ID；空分支也有版本 ID。末章由 `chapters` 最后一项标识。分支来源字段用于展示分支从哪条路线、哪个章节创建。`chapters` 每项为 `{id,parentId,title,body,author,createdAt,revisions}`。每项 `revisions` 为按时间排列的 `{id,title,body,author,createdAt,message}`，最后一项是当前版本。

## 写入与错误

所有写入在修改状态前验证参数与并发基准，并先成功持久化再返回。`localStorage` 不可用、空间不足、数据损坏、参数无效、目标不存在或 `expectedHead` 过期均抛出中文 `Error`；失败不得返回成功或静默丢弃修改。损坏或结构不兼容的数据会报错，不会自动用演示数据覆盖。每次写入前重新读取持久化状态，可检测已落盘的其他标签页更新；`localStorage` 没有原子比较并交换操作，因此极短时间内完全同时写入仍存在竞态。空字符串章节正文允许保存，标题必填。草稿可包含 UI 自定义字段。

新增章节只能接在当前分支末尾；从非末尾节点继续故事应先调用 `createBranch`，由 UI 决定何时分支。章节 ID 在作品内稳定且唯一。作品及分支 ID 由数据层生成。
