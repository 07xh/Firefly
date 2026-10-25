---
title: "Python 常用符号图鉴：一眼看懂代码里的每个符号"
published: 2026-10-25
description: "零基础友好的 Python 符号速查图鉴，分 5 类认识括号、代码结构、运算比较、f-string 与进阶语法，含 20 张符号卡片、代码示例和自测练习。"
category: "Python"
draft: false
tags: ["Python","编程入门","语法基础","符号速查"]
slug: "python-symbol-guide"
---

<style>
.pyg-guide{--p-bg:#f7f9fd;--p-card:#fff;--p-text:#1d2940;--p-muted:#63718a;--p-border:#e1e8f2;--p-soft:#edf2fb;--p-code:#142036;--p-blue:#4169e1;--p-green:#139c7c;--p-red:#db5772;--p-purple:#8360d9;--p-orange:#db8b2c;color:var(--p-text);font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;line-height:1.75;max-width:1060px;margin:0 auto}
.pyg-guide *{box-sizing:border-box}.pyg-guide a{color:inherit;text-decoration:none}.pyg-guide .pyg-hero{background:linear-gradient(123deg,#1e2c50 0%,#3153a4 65%,#4e69bd 100%);color:#fff;border-radius:24px;padding:clamp(24px,4vw,50px);position:relative;overflow:hidden}
.pyg-guide .pyg-hero:after{content:'{ }';position:absolute;right:-22px;top:-52px;color:rgba(255,255,255,.09);font:900 220px/1 ui-monospace,SFMono-Regular,Consolas,monospace;pointer-events:none}
.pyg-guide .pyg-overline{display:inline-block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);border-radius:99px;padding:4px 12px;font-size:12px;font-weight:650;letter-spacing:.07em}
.pyg-guide .pyg-hero h1{font-size:clamp(26px,4.2vw,46px);line-height:1.25;color:#fff;margin:16px 0 12px;letter-spacing:-.035em;max-width:780px}
.pyg-guide .pyg-hero p{max-width:700px;margin:0;color:#e1eaff;font-size:15px}.pyg-guide .pyg-meta{display:flex;flex-wrap:wrap;gap:9px;margin-top:22px}.pyg-guide .pyg-meta span{background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.18);border-radius:9px;padding:5px 10px;font-size:12px}
.pyg-guide .pyg-head{margin:44px 0 17px}.pyg-guide .pyg-head .pyg-label{font-size:12px;letter-spacing:.08em;font-weight:800;color:var(--p-blue)}.pyg-guide .pyg-head h2{font-size:clamp(23px,3vw,29px);line-height:1.35;color:var(--p-text);margin:4px 0 8px}.pyg-guide .pyg-head p{font-size:14px;color:var(--p-muted);margin:0}
.pyg-guide .pyg-nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:18px 0 0}.pyg-guide .pyg-nav a{border:1px solid var(--p-border);border-radius:14px;padding:13px 12px;background:var(--p-card);font-weight:650;font-size:13px;transition:transform .2s,border-color .2s;min-height:70px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}.pyg-guide .pyg-nav a:hover{transform:translateY(-2px);border-color:#a9bde7}.pyg-guide .pyg-nav small{font-size:11px;color:var(--p-muted);font-weight:500}.pyg-guide .pyg-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:var(--accent)}
.pyg-guide .pyg-brief{border-radius:14px;border:1px solid #bfd5f6;background:linear-gradient(90deg,#ecf4ff,#f7faff);padding:15px 18px;margin:20px 0 4px;font-size:14px;color:#37547d}
.pyg-guide .pyg-section{scroll-margin-top:26px}.pyg-guide .pyg-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pyg-guide .pyg-symbol-card{background:var(--p-card);border:1px solid var(--p-border);border-radius:18px;padding:20px;min-width:0;box-shadow:0 5px 18px rgba(35,52,90,.035)}.pyg-guide .pyg-symbol-card .pyg-top{display:flex;align-items:center;gap:15px;margin-bottom:10px}.pyg-guide .pyg-symbol{display:flex;align-items:center;justify-content:center;flex-shrink:0;min-width:69px;max-width:150px;min-height:60px;padding:7px 11px;border:1px solid color-mix(in srgb,var(--accent) 20%,white);border-radius:13px;color:var(--accent);background:color-mix(in srgb,var(--accent) 9%,white);font:800 clamp(20px,3vw,27px)/1.2 ui-monospace,Consolas,monospace;letter-spacing:-.045em;white-space:nowrap}.pyg-guide .pyg-symbol.pyg-long{font-size:16px}.pyg-guide .pyg-symbol-card h3{font-size:17px;color:var(--p-text);line-height:1.35;margin:0 0 3px}.pyg-guide .pyg-symbol-card .pyg-desc{font-size:12px;color:var(--p-muted);line-height:1.55}.pyg-guide .pyg-symbol-card .pyg-usage{font-size:12px;color:var(--p-muted);margin:0 0 8px}.pyg-guide .pyg-symbol-card .pyg-code-mini{display:block;background:var(--p-soft);border-radius:9px;padding:10px 12px;color:#294c83;font:12px/1.65 ui-monospace,Consolas,monospace;overflow-x:auto;white-space:normal;overflow-wrap:anywhere}.pyg-guide .pyg-symbol-card .pyg-tip{border-left:2px solid var(--accent);padding:7px 0 7px 10px;color:var(--p-muted);font-size:12px;margin-top:12px}
.pyg-guide .pyg-symbol-card code,.pyg-guide .pyg-guide-inline{font-family:ui-monospace,Consolas,monospace}.pyg-guide .pyg-examples{display:grid;gap:16px}.pyg-guide .pyg-example{background:var(--p-card);border:1px solid var(--p-border);border-radius:17px;overflow:hidden}.pyg-guide .pyg-example-hd{padding:14px 18px}.pyg-guide .pyg-example-hd h3{margin:0;font-size:15px;color:var(--p-text)}.pyg-guide .pyg-example-hd p{margin:3px 0 0;font-size:12px;color:var(--p-muted)}.pyg-guide .pyg-example pre{margin:0;padding:18px 20px;background:#142036;color:#d5e5ff;overflow-x:auto;font:13px/1.75 ui-monospace,SFMono-Regular,Consolas,monospace;border-radius:0}.pyg-guide .pyg-example pre code{font:inherit}.pyg-guide .pyg-example .highlight{background:transparent}
.pyg-guide .pyg-table-wrap{overflow-x:auto;border:1px solid var(--p-border);border-radius:15px;background:var(--p-card)}.pyg-guide table{border-collapse:collapse;width:100%;font-size:13px;background:transparent;margin:0;min-width:610px}.pyg-guide th{background:var(--p-soft);text-align:left;color:var(--p-text);padding:12px 15px}.pyg-guide td{padding:13px 15px;border-top:1px solid var(--p-border);vertical-align:top;color:var(--p-muted)}.pyg-guide table code{font-family:ui-monospace,Consolas,monospace;color:var(--p-blue);background:var(--p-soft);padding:2px 5px;border-radius:5px}
.pyg-guide .pyg-quiz{background:var(--p-card);border:1px solid var(--p-border);border-radius:17px;padding:20px 23px}.pyg-guide .pyg-quiz ol{padding-left:23px;margin:0}.pyg-guide .pyg-quiz li{margin-bottom:11px}.pyg-guide details{border-radius:11px;border:1px solid var(--p-border);background:var(--p-bg);padding:9px 15px;margin-top:15px}.pyg-guide summary{cursor:pointer;font-weight:700;color:var(--p-blue)}.pyg-guide .pyg-outro{font-size:14px;border-top:1px solid var(--p-border);color:var(--p-muted);padding:24px 2px;margin-top:35px}.pyg-guide .pyg-outro strong{color:var(--p-text)}
:is(html.dark,body.dark,html[data-theme="dark"],body[data-theme="dark"]) .pyg-guide{--p-bg:#192438;--p-card:#1f2c42;--p-text:#f0f4fc;--p-muted:#bbc6db;--p-border:#384860;--p-soft:#293a55}
.pyg-guide .k{color:#e9a4fe}.pyg-guide .kn{color:#e9a4fe}.pyg-guide .nb{color:#89d9ff}.pyg-guide .nf{color:#9cdcff}.pyg-guide .s,.pyg-guide .s2,.pyg-guide .s1{color:#abecb7}.pyg-guide .mi,.pyg-guide .mf{color:#ffcd80}.pyg-guide .c1,.pyg-guide .cp{color:#8599b6}.pyg-guide .ow,.pyg-guide .o{color:#ffacc4}.pyg-guide .nn{color:#cfc0ff}
@media(max-width:720px){.pyg-guide .pyg-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.pyg-guide .pyg-card-grid{grid-template-columns:1fr}.pyg-guide .pyg-symbol-card{padding:16px}.pyg-guide .pyg-hero{border-radius:18px}.pyg-guide .pyg-hero:after{font-size:120px;right:-15px;top:0}.pyg-guide .pyg-head{margin-top:35px}}
@media(prefers-color-scheme:dark){.pyg-guide{--p-bg:#192438;--p-card:#1f2c42;--p-text:#f0f4fc;--p-muted:#bbc6db;--p-border:#384860;--p-soft:#293a55}.pyg-guide .pyg-brief{background:#22395b;border-color:#3c5680;color:#d9e8ff}.pyg-guide .pyg-symbol-card .pyg-symbol{background:color-mix(in srgb,var(--accent) 15%,#202c42);border-color:color-mix(in srgb,var(--accent) 38%,#202c42)}.pyg-guide .pyg-symbol-card .pyg-code-mini{color:#b4d1ff}.pyg-guide .pyg-hero{background:linear-gradient(130deg,#182649,#253b79,#324b86)}}
</style>

<div class="pyg-guide">
<header class="pyg-hero" id="pyg-top"><span class="pyg-overline">PYTHON · BEGINNER GUIDE</span>
<h1>Python 常用符号图鉴<br>一眼看懂代码里的每个符号</h1>
<p>不再对着括号和冒号发愁。按用途认识 5 类常见符号，配上实际代码，阅读、练习、速查一次搞定。</p>
<div class="pyg-meta"><span>📘 零基础友好</span><span>🧩 5 类符号</span><span>💻 4 段运行示例</span><span>✅ 3 道自测题</span></div></header>
<div class="pyg-head"><div class="pyg-label">START HERE</div><h2>先看这张符号地图</h2><p>从你最常见的符号开始，点击卡片就能跳转到详细解释。</p></div>
<nav class="pyg-nav" aria-label="符号分类">
<a href="#brackets"><span>🔵 括号与容器</span><small>()  []  {}</small></a>
<a href="#punctuation"><span>🟢 标点与结构</span><small>:  .  #</small></a>
<a href="#operators"><span>🔴 判断与运算</span><small>=  ==  !=</small></a>
<a href="#format"><span>🟣 格式与输出</span><small>f-string</small></a>
<a href="#advanced"><span>🟠 进阶语法</span><small>-&gt;  @  :=</small></a>
</nav>
<div class="pyg-brief">💡 <strong>学习建议：</strong>先掌握 <code>()</code>、<code>[]</code>、<code>{}</code>、<code>:</code>、<code>=</code>、<code>==</code>，再学 f-string 和进阶符号。一次不必背完。</div>
<section id="brackets" class="pyg-section" style="--accent:#4169e1"><div class="pyg-head"><div class="pyg-label">SECTION 01</div><h2>括号与容器</h2><p>先记住：括号的作用取决于它所在的位置。</p></div><div class="pyg-card-grid">
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">()</span><div><h3>圆括号</h3><div class="pyg-desc">函数调用 · 优先级 · 元组</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">print(&#x27;你好&#x27;)
(2 + 3) * 4
(1, 2)</code><div class="pyg-tip">单个元素的元组要写 <code>(1,)</code>，<code>(1)</code> 只是数字 1。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">[]</span><div><h3>方括号</h3><div class="pyg-desc">列表 · 索引 · 切片</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">nums = [10, 20, 30]
nums[0]
nums[1:3]</code><div class="pyg-tip">索引从 0 开始；切片包含起点、不包含终点。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">{}</span><div><h3>花括号</h3><div class="pyg-desc">字典 · 集合 · f-string 占位</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">user = {&#x27;name&#x27;: &#x27;小明&#x27;}
{1, 2, 3}</code><div class="pyg-tip">空的 <code>{}</code> 是字典；空集合必须用 <code>set()</code>。</div></article>
</div></section>
<section id="punctuation" class="pyg-section" style="--accent:#139c7c"><div class="pyg-head"><div class="pyg-label">SECTION 02</div><h2>标点与代码结构</h2><p>看懂语句怎么连接，代码怎么分层。</p></div><div class="pyg-card-grid">
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">:</span><div><h3>冒号</h3><div class="pyg-desc">开启代码块 · 字典键值 · 切片</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">if score &gt;= 60:
{&#x27;a&#x27;: 1}
nums[1:3]</code><div class="pyg-tip"><code>if / for / while / def</code> 后通常需要冒号和下一行的缩进。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">.</span><div><h3>点号</h3><div class="pyg-desc">访问属性 · 调用方法</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">name.upper()
math.pi</code><div class="pyg-tip">先找到对象，再用点号访问它的属性或方法。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">#</span><div><h3>井号</h3><div class="pyg-desc">单行注释</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">score = 90  # 测试分数</code><div class="pyg-tip">注释是写给阅读代码的人看的，不会像普通语句那样执行。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">,</span><div><h3>逗号</h3><div class="pyg-desc">分隔元素 · 分隔参数</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">print(&#x27;姓名&#x27;, &#x27;分数&#x27;)
[1, 2, 3]</code><div class="pyg-tip">经常出现在函数参数、列表、元组和字典里。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">_</span><div><h3>下划线</h3><div class="pyg-desc">变量命名 · 数字分组 · 惯用占位</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">user_name = &#x27;小明&#x27;
1_000_000
for _ in range(3)</code><div class="pyg-tip"><code>_name</code> 通常表示内部使用的名字，但不是强制权限控制。</div></article>
</div></section>
<section id="operators" class="pyg-section" style="--accent:#db5772"><div class="pyg-head"><div class="pyg-label">SECTION 03</div><h2>赋值、比较与运算</h2><p>特别注意：赋值不是比较，比较也不是赋值。</p></div><div class="pyg-card-grid">
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">=</span><div><h3>赋值</h3><div class="pyg-desc">把右侧结果保存到变量</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">score = 92</code><div class="pyg-tip">这里不是在判断左右是否相等。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">==</span><div><h3>相等比较</h3><div class="pyg-desc">得到 True 或 False</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">score == 92</code><div class="pyg-tip">写条件时很常见：<code>if score == 92:</code>。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">!=</span><div><h3>不等比较</h3><div class="pyg-desc">判断两个值不同</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">score != 60</code><div class="pyg-tip">还常用 <code>&lt;</code>、<code>&gt;</code>、<code>&lt;=</code>、<code>&gt;=</code> 比较大小。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">//  %</span><div><h3>整除 · 取余</h3><div class="pyg-desc">分别得到商的向下取整值与余数</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">7 // 2  # 3
7 % 2  # 1</code><div class="pyg-tip"><code>/</code> 是普通除法；<code>**</code> 表示乘方，例如 <code>2 ** 3</code>。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol pyg-long">and or not</span><div><h3>逻辑运算</h3><div class="pyg-desc">组合条件 · 否定条件</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">score &gt;= 60 and score &lt;= 100</code><div class="pyg-tip"><code>in</code> 用来检查成员；<code>is</code> 用来比较是否为同一对象，不应代替 <code>==</code>。</div></article>
</div></section>
<section id="format" class="pyg-section" style="--accent:#8360d9"><div class="pyg-head"><div class="pyg-label">SECTION 04</div><h2>格式化与输出</h2><p>把变量变成易读的文字，是入门阶段最常用的技巧。</p></div><div class="pyg-card-grid">
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">f&quot;…&quot;</span><div><h3>f-string</h3><div class="pyg-desc">在字符串里插入变量</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">f&#x27;第{rank}名：{score}分&#x27;</code><div class="pyg-tip">在 f-string 中，<code>{}</code> 是插入表达式的位置，不是在创建字典。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol pyg-long">{x:.2f}</span><div><h3>小数格式</h3><div class="pyg-desc">保留两位小数进行显示</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">f&#x27;{price:.2f}元&#x27;</code><div class="pyg-tip"><code>.2f</code> 控制显示两位小数，不会永久修改原变量。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">\n</span><div><h3>换行转义</h3><div class="pyg-desc">一个字符串中表示换行</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">print(&#x27;第一行\n第二行&#x27;)</code><div class="pyg-tip">想原样显示反斜杠，可了解原始字符串 <code>r&#x27;...&#x27;</code>。</div></article>
</div></section>
<section id="advanced" class="pyg-section" style="--accent:#db8b2c"><div class="pyg-head"><div class="pyg-label">SECTION 05</div><h2>认识进阶符号</h2><p>先会识别用途，写项目时再深入掌握。</p></div><div class="pyg-card-grid">
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">*  **</span><div><h3>星号与双星号</h3><div class="pyg-desc">乘法 · 乘方 · 参数解包</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">2 * 3
2 ** 3
print(*[1, 2, 3])</code><div class="pyg-tip">在函数参数中，<code>*args</code> 收集位置参数，<code>**kwargs</code> 收集关键字参数。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">-&gt;</span><div><h3>类型提示箭头</h3><div class="pyg-desc">标注函数预期返回值</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">def add(a: int, b: int) -&gt; int:</code><div class="pyg-tip">类型提示通常不会自动阻止传入其他类型的值。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">@</span><div><h3>装饰器</h3><div class="pyg-desc">给函数应用额外功能</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">@my_decorator</code><div class="pyg-tip">初学阶段只需认识：它常出现在函数定义上一行。</div></article>
<article class="pyg-symbol-card"><div class="pyg-top"><span class="pyg-symbol">:=</span><div><h3>海象运算符</h3><div class="pyg-desc">在表达式中完成赋值</div></div></div><div class="pyg-usage">常见写法</div><code class="pyg-code-mini" style="white-space:pre-wrap">if (n := len(&#x27;hello&#x27;)) &gt; 3:</code><div class="pyg-tip">Python 3.8+ 支持；初学者先掌握普通的 <code>=</code> 即可。</div></article>
</div></section>
<section class="pyg-section" id="examples"><div class="pyg-head"><div class="pyg-label">PRACTICE</div><h2>把知识点连起来：4 段代码</h2><p>每段代码都可以直接复制到 Python 里运行。</p></div><div class="pyg-examples">
<article class="pyg-example"><div class="pyg-example-hd"><h3>01 / 括号与索引</h3><p>看看方括号为什么既能创建列表，也能读取某个位置。</p></div><pre><code><span class="n">names</span> <span class="o">=</span> <span class="p">[</span><span class="s2">&quot;小明&quot;</span><span class="p">,</span> <span class="s2">&quot;小红&quot;</span><span class="p">,</span> <span class="s2">&quot;小林&quot;</span><span class="p">]</span>
<span class="nb">print</span><span class="p">(</span><span class="n">names</span><span class="p">[</span><span class="mi">0</span><span class="p">])</span>       <span class="c1"># 小明</span>
<span class="nb">print</span><span class="p">(</span><span class="n">names</span><span class="p">[</span><span class="mi">1</span><span class="p">:</span><span class="mi">3</span><span class="p">])</span>     <span class="c1"># [&#39;小红&#39;, &#39;小林&#39;]</span></code></pre></article>
<article class="pyg-example"><div class="pyg-example-hd"><h3>02 / 判断与缩进</h3><p><code>:</code> 表示代码块开始，下面要缩进。<code>==</code> 才是相等判断。</p></div><pre><code><span class="n">score</span> <span class="o">=</span> <span class="mi">92</span>
<span class="k">if</span> <span class="n">score</span> <span class="o">&gt;=</span> <span class="mi">60</span><span class="p">:</span>
    <span class="nb">print</span><span class="p">(</span><span class="s2">&quot;及格&quot;</span><span class="p">)</span>
<span class="k">if</span> <span class="n">score</span> <span class="o">==</span> <span class="mi">92</span><span class="p">:</span>
    <span class="nb">print</span><span class="p">(</span><span class="s2">&quot;正好 92 分&quot;</span><span class="p">)</span></code></pre></article>
<article class="pyg-example"><div class="pyg-example-hd"><h3>03 / f-string 与 enumerate</h3><p>把序号、姓名和分数一起输出。</p></div><pre><code><span class="n">scores</span> <span class="o">=</span> <span class="p">[(</span><span class="s2">&quot;小明&quot;</span><span class="p">,</span> <span class="mi">92</span><span class="p">),</span> <span class="p">(</span><span class="s2">&quot;小红&quot;</span><span class="p">,</span> <span class="mi">88</span><span class="p">)]</span>
<span class="k">for</span> <span class="n">rank</span><span class="p">,</span> <span class="p">(</span><span class="n">name</span><span class="p">,</span> <span class="n">score</span><span class="p">)</span> <span class="ow">in</span> <span class="nb">enumerate</span><span class="p">(</span><span class="n">scores</span><span class="p">,</span> <span class="n">start</span><span class="o">=</span><span class="mi">1</span><span class="p">):</span>
    <span class="nb">print</span><span class="p">(</span><span class="sa">f</span><span class="s2">&quot;第</span><span class="si">{</span><span class="n">rank</span><span class="si">}</span><span class="s2">位：</span><span class="si">{</span><span class="n">name</span><span class="si">}</span><span class="s2">，</span><span class="si">{</span><span class="n">score</span><span class="si">}</span><span class="s2">分&quot;</span><span class="p">)</span></code></pre></article>
<article class="pyg-example"><div class="pyg-example-hd"><h3>04 / 常用方法</h3><p>点号 <code>.</code> 可以调用字符串和列表自己的方法。</p></div><pre><code><span class="n">name</span> <span class="o">=</span> <span class="s2">&quot;python&quot;</span>
<span class="nb">print</span><span class="p">(</span><span class="n">name</span><span class="o">.</span><span class="n">upper</span><span class="p">())</span>   <span class="c1"># PYTHON</span>
<span class="n">numbers</span> <span class="o">=</span> <span class="p">[</span><span class="mi">1</span><span class="p">,</span> <span class="mi">2</span><span class="p">]</span>
<span class="n">numbers</span><span class="o">.</span><span class="n">append</span><span class="p">(</span><span class="mi">3</span><span class="p">)</span>
<span class="nb">print</span><span class="p">(</span><span class="n">numbers</span><span class="p">)</span>        <span class="c1"># [1, 2, 3]</span></code></pre></article>
</div></section>
<section id="comparison" class="pyg-section"><div class="pyg-head"><div class="pyg-label">CHEAT SHEET</div><h2>6 组容易混淆的符号</h2><p>看到相似符号时，先对照“用途”，再看一眼例子。</p></div><div class="pyg-table-wrap"><table><thead><tr><th>符号</th><th>怎么区分</th><th>示例</th></tr></thead><tbody>
<tr><td><code>=</code> vs <code>==</code></td><td>赋值 vs 判断相等</td><td><code>x = 3</code> / <code>x == 3</code></td></tr>
<tr><td><code>[]</code> vs <code>()</code></td><td>列表、取索引 vs 函数调用、元组等</td><td><code>a[0]</code> / <code>print(a)</code></td></tr>
<tr><td><code>{}</code> vs <code>{x}</code></td><td>空字典 vs f-string 中的占位表达式</td><td><code>d = {}</code> / <code>f&#x27;{x}&#x27;</code></td></tr>
<tr><td><code>/</code> vs <code>//</code></td><td>普通除法 vs 向下取整除法</td><td><code>7 / 2</code> → <code>3.5</code> / <code>7 // 2</code> → <code>3</code></td></tr>
<tr><td><code>==</code> vs <code>is</code></td><td>值相等 vs 是否为同一对象</td><td>通常判断数值或文本是否相等用 <code>==</code></td></tr>
<tr><td><code>:</code> vs 缩进</td><td>冒号标记块，缩进定义块的范围</td><td><code>if ok:</code> 后下一行缩进</td></tr>
</tbody></table></div></section>
<section id="quiz" class="pyg-section"><div class="pyg-head"><div class="pyg-label">SELF CHECK</div><h2>3 道一分钟小测</h2><p>看到答案前先自己判断一下。</p></div><div class="pyg-quiz"><ol><li>判断 <code>score</code> 是否等于 90：A. <code>score = 90</code>　B. <code>score == 90</code></li><li><code>letters = ["a", "b", "c"]</code>，<code>letters[1]</code> 是什么？</li><li><code>name = "小明"</code>，补全 <code>print(f"你好，____")</code>。</li></ol><details><summary>展开答案和解释</summary><ol><li><strong>B</strong>：<code>==</code> 用于比较。</li><li><strong>"b"</strong>：列表从 0 开始计数。</li><li><strong>{name}</strong>：花括号在 f-string 中插入变量。</li></ol></details></div></section>
<footer class="pyg-outro"><strong>学会认符号，代码就会好读很多。</strong> 先判断它属于容器、结构、运算还是输出，再试着运行一个小例子。欢迎在评论区分享你最容易混淆的符号。</footer></div>
