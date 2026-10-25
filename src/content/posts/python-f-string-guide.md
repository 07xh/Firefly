---
title: "Python f-string 学习指南：从入门到进阶"
published: 2026-10-25
description: "一篇面向初学者的 f-string 学习笔记，讲解基本插值、格式说明符、对齐宽度、进制与日期格式化、调试用 = 写法，以及引号嵌套和反斜杠等常见坑。"
category: "Python 基础"
draft: false
tags: ["Python","f-string","字符串格式化","教程"]
slug: "python-f-string-guide"
---
# Python f-string 学习指南

## 一、f-string 是什么

f-string 也叫格式化字符串字面量，是 Python 3.6 引入的写法：在字符串前加 `f` 或 `F`，用 `{}` 嵌入表达式。

```python
name = "小明"
age = 18
print(f"我叫{name}，今年{age}岁")
```

输出：`我叫小明，今年18岁`。相比 `%` 格式化和 `str.format()`，f-string 更短、可读性更好，通常也更快。

## 二、基本用法

`{}` 里可以放变量、运算、函数调用、方法调用，几乎任何表达式都行。

```python
x = 3
print(f"{x} 的平方是 {x ** 2}")
print(f"大写：{'hello'.upper()}")
print(f"长度：{len('python')}")
```

字典和列表可以直接用下标取值：

```python
user = {"name": "Tom", "age": 20}
print(f"{user['name']} 已经 {user['age']} 岁")
```

注意引号：外层用双引号时，字典键用单引号，避免引号冲突。

## 三、格式说明符

`{}` 内用 `:` 分隔表达式和格式说明，语法为 `{表达式:格式}`。

```python
pi = 3.1415926
print(f"{pi:.2f}")      # 3.14，保留两位小数
print(f"{1234567:,}")   # 1,234,567，千分位
print(f"{0.256:.1%}")   # 25.6%，百分比
print(f"{42:08.2f}")    # 00042.00，补零
```

对齐与宽度：

```python
for s in ["a", "bb", "ccc"]:
    print(f"|{s:>6}|{s:^6}|{s:<6}|")
```

`>` 右对齐、`^` 居中、`<` 左对齐，数字表示总宽度。字符串默认左对齐，数字默认右对齐。

进制转换：

```python
n = 255
print(f"{n:b} {n:o} {n:x} {n:X}")  # 11111111 377 ff FF
```

日期格式化：

```python
from datetime import datetime
now = datetime(2024, 5, 1, 13, 5)
print(f"{now:%Y-%m-%d %H:%M}")  # 2024-05-01 13:05
```

## 四、调试小技巧：=

Python 3.8 起，在表达式后加 `=` 可以同时打印表达式文本和它的值：

```python
count = 10
print(f"{count=}")        # count=10
print(f"{count * 2=}")    # count * 2=20
print(f"{count=:.2f}")    # count=10.00
```

调试时很省事，不必再写 `print("count =", count)`。

## 五、多行与嵌套引号

三引号 f-string 可以写多行：

```python
name = "小明"
score = 95
msg = f"""
姓名：{name}
成绩：{score}
"""
```

引号规则需要留意：Python 3.12 之前，f-string 内部的引号不能与外层引号相同；3.12 起放宽了这一限制，同一个表达式里可以使用相同引号。如果不确定运行环境，建议内外使用不同引号，兼容性最好。

## 六、常见坑

1. 想输出大括号本身要双写：`f"{{}}"` 得到 `{}`。
2. Python 3.12 之前，`{}` 内不能出现反斜杠，例如 `f"{'\n'.join(a)}"` 会报错，可以先把结果算好再插入。
3. `{}` 内不能写注释，也不能出现 `#`。
4. 不要在 `{}` 里塞太复杂的逻辑，可读性比少写一行更重要。
5. f-string 在定义时立即求值，不是延迟求值。

## 七、和其他方式对比

```python
name = "小明"
"%s" % name          # % 格式化
"{}".format(name)    # str.format
f"{name}"            # f-string
```

简单场景三者都能用，新代码优先选 f-string。但如果是用户自定义模板（比如配置文件里的占位符），应使用 `str.format()` 或 `string.Template`，因为 f-string 必须在源码中写死，无法在运行时解析外部模板。

## 八、小结

日常使用记住四点就够：`{}` 放表达式、`:` 接格式说明、`=` 辅助调试、注意引号与反斜杠限制。多写几次格式化输出，很快就能熟练。
