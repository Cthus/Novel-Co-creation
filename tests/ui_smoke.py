"""Optional browser check: python tests/ui_smoke.py (requires Playwright + Chrome)."""
import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "playwright"
OUT.mkdir(parents=True, exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_port}/"
checks = []


def passed(label):
    checks.append(label)
    print("PASS:", label, flush=True)


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            page.goto(base + "start.html")
            expect(page.get_by_role("heading", name="让故事从一个节点继续。")).to_be_visible()
            page.screenshot(path=str(OUT / "desktop-home.png"))
            page.goto(base + "main.html")
            expect(page.get_by_role("heading", name="我的作品", exact=True)).to_be_visible()
            page.goto(base + "new.html")
            page.locator("#title").fill("雾港验收作品")
            page.locator("#description").fill("一次关于雨夜的共同写作。")
            page.locator("#rules").fill("保留每条故事线的独立发展。")
            page.get_by_role("button", name="创建作品", exact=True).click()
            expect(page.get_by_role("heading", name="这条故事线尚无章节")).to_be_visible()
            page.get_by_role("link", name="写第一章").click()
            page.locator("#chapterTitle").fill("第一章 来信")
            original = "旧的句子。\n保留的句子。\n<img src=x onerror=alert(1)>"
            page.locator("#chapterBody").fill(original)
            page.reload()
            expect(page.locator("#chapterBody")).to_have_value(original)
            passed("创建作品、即时刷新草稿恢复")
            page.locator("#submitChapter").click()
            expect(page.locator("#chapterText")).to_have_text(original)
            first_url = page.url
            params = parse_qs(urlparse(first_url).query)
            main_branch = params["branch"][0]
            page.get_by_role("link", name="修订章节", exact=True).click()
            revised = "新的句子。\n保留的句子。\n<img src=x onerror=alert(1)>"
            page.locator("#chapterTitle").fill("第一章 新来信")
            page.locator("#chapterBody").fill(revised)
            page.locator("#message").fill("改写第一句")
            page.locator("#submitChapter").click()
            expect(page.locator("#chapterText")).to_have_text(revised)
            page.locator("#diffToggle").check()
            expect(page.locator("#diffText del")).to_contain_text("旧的句子。")
            assert page.locator("#diffText img").count() == 0
            page.screenshot(path=str(OUT / "desktop-revisions.png"))
            page.locator("#diffToggle").uncheck()
            expect(page.locator("#chapterText")).to_be_visible()
            page.locator("#revisionSelect").select_option("0")
            expect(page.locator("#chapterText")).to_have_text(original)
            expect(page.get_by_role("heading", name="第一章 来信", exact=True)).to_be_visible()
            expect(page.locator("#diffToggle")).to_be_disabled()
            page.locator("#revisionSelect").select_option("1")
            expect(page.locator("#chapterText")).to_have_text(revised)
            expect(page.get_by_role("heading", name="第一章 新来信", exact=True)).to_be_visible()
            passed("历史版本标题正文一致、任意版本阅读与返回最新")
            passed("章节提交、修订删除线、正文转义和阅读切换")
            page.get_by_role("link", name="续写下一章", exact=True).click()
            expect(page.locator("#chapterBody")).to_have_value("")
            page.locator("#chapterTitle").fill("第二章 灯塔")
            page.locator("#chapterBody").fill("主线的灯塔亮了。")
            page.locator("#submitChapter").click()
            expect(page.locator("#chapterText")).to_have_text("主线的灯塔亮了。")
            assert page.locator(".chapter-link").count() == 2
            page.goto(first_url)
            page.once("dialog", lambda dialog: dialog.accept("向海的路线"))
            page.locator("#branchStart").click()
            expect(page.locator("#chapterTitle")).to_be_visible()
            page.locator("#chapterTitle").fill("第二章 海潮")
            page.locator("#chapterBody").fill("另一条路线的潮声。")
            page.locator("#submitChapter").click()
            expect(page.locator("#chapterText")).to_have_text("另一条路线的潮声。")
            assert page.locator(".chapter-link").count() == 2
            assert "灯塔" not in page.locator(".chapter-list").inner_text()
            page.locator(".chapter-link").first.click()
            page.get_by_role("link", name="修订章节", exact=True).click()
            page.locator("#chapterBody").fill("分支独有的开篇。")
            page.locator("#submitChapter").click()
            expect(page.locator("#chapterText")).to_have_text("分支独有的开篇。")
            page.locator("#branchSelect").select_option(main_branch)
            expect(page.locator("#chapterText")).to_have_text("主线的灯塔亮了。")
            page.goto(first_url)
            expect(page.locator("#chapterText")).to_have_text(revised)
            passed("主线续写、从中间节点分支、共享章节修订隔离")
            with page.expect_download() as download_info:
                page.locator("#exportBtn").click()
            export = json.loads(Path(download_info.value.path()).read_text(encoding="utf-8"))
            assert export["title"] == "雾港验收作品" and len(export["branches"]) == 2
            passed("作品 JSON 导出包含两条完整故事线")
            page.get_by_role("link", name="修订章节", exact=True).click()
            edit_url = page.url
            second = context.new_page()
            second.goto(edit_url)
            page.locator("#chapterBody").fill("第一个窗口提交。")
            page.locator("#submitChapter").click()
            expect(page.locator("#chapterText")).to_have_text("第一个窗口提交。")
            second.locator("#chapterBody").fill("第二个窗口的未提交内容。")
            second.locator("#submitChapter").click()
            expect(second.locator("#chapterBody")).to_have_value("第二个窗口的未提交内容。")
            expect(second.locator("#submitError")).not_to_be_empty()
            page.reload()
            expect(page.locator("#chapterText")).to_have_text("第一个窗口提交。")
            second.reload()
            expect(second.locator("#chapterBody")).to_have_value("第二个窗口的未提交内容。")
            with second.expect_download() as draft_download:
                second.locator("#downloadDraft").click()
            draft_export = json.loads(Path(draft_download.value.path()).read_text(encoding="utf-8"))
            assert draft_export["body"] == "第二个窗口的未提交内容。"
            second.once("dialog", lambda dialog: dialog.accept())
            second.locator("#acceptLatest").click()
            expect(second.locator("#chapterBody")).to_have_value("第二个窗口的未提交内容。")
            second.locator("#submitChapter").click()
            expect(second.locator("#chapterText")).to_have_text("第二个窗口的未提交内容。")
            second.get_by_role("link", name="修订章节", exact=True).click()
            assert "已恢复本地草稿" not in second.locator("#draftStatus").inner_text()
            second.close()
            passed("过期提交拒绝、草稿导出及明确采用新基准、提交后草稿清理")
            page.set_viewport_size({"width": 390, "height": 844})
            page.goto(first_url)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            page.screenshot(path=str(OUT / "mobile-read.png"), full_page=True)
            page.get_by_role("link", name="修订章节", exact=True).click()
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            page.screenshot(path=str(OUT / "mobile-editor.png"), full_page=True)
            page.evaluate("() => { window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function() { throw new DOMException('quota', 'QuotaExceededError'); }; }")
            page.locator("#chapterBody").fill("存储失败时必须保留的正文。")
            expect(page.locator("#draftStatus")).to_contain_text("未能保存")
            page.locator("#submitChapter").click()
            expect(page.locator("#submitError")).to_contain_text("存储失败")
            expect(page.locator("#chapterBody")).to_have_value("存储失败时必须保留的正文。")
            page.evaluate("() => { Storage.prototype.setItem = window.originalSetItem; }")
            page.locator("#submitChapter").click()
            expect(page.locator("#chapterText")).to_have_text("存储失败时必须保留的正文。")
            passed("模拟存储配额失败诚实反馈、保留输入及恢复后重试")
            page.goto(base + "main.html")
            page.locator("#menuBtn").click()
            expect(page.locator(".side-nav")).to_be_visible()
            page.locator("#menuBtn").click()
            expect(page.locator(".side-nav")).not_to_be_visible()
            passed("390px 手机阅读、编辑布局及导航开关")
            page.goto(base + "read.html?id=not-found")
            expect(page.get_by_role("link", name="回到作品列表")).to_be_visible()
            page.goto(base + "signin.html")
            expect(page.get_by_role("heading", name="尚未接入 GitHub 登录")).to_be_visible()
            assert not errors, errors
            passed("无效链接恢复、身份边界说明、无页面脚本异常")
            (OUT / "results.json").write_text(json.dumps({"passed": checks, "pageErrors": errors}, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            page.screenshot(path=str(OUT / "failure.png"), full_page=True)
            raise
        finally:
            browser.close()
finally:
    server.shutdown()
    server.server_close()
