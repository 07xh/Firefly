---
title: "Python 常见符号详解：从括号到运算符"
published: 2026-10-25
description: "用符号表、Python 语法高亮示例与运行结果，系统掌握括号、赋值、比较、运算、注释和逻辑符号。"
category: "Python"
draft: false
tags: ["Python基础", "语法符号", "运算符", "编程入门"]
slug: "Python2"
---

# Python 常见符号详解：从括号到运算符

刚开始学习 Python 时，经常会看到 `()`、`[]`、`{}`、`:`、`=`、`==` 等符号。它们决定了**代码如何组织、数据如何存储，以及程序如何进行计算和判断**。

本文按照实际使用场景，采用和上一篇相同的**Markdown 标题、符号表格、行内代码和语法高亮代码块**，并附上运行结果，方便快速查阅。

## 一、三种常见括号

| 符号 | 常见作用 | 示例 |
| --- | --- | --- |
| `()` | 函数调用、改变运算顺序、元组 | `print("Hello")` |
| `[]` | 列表、索引、切片 | `scores[0]` |
| `{}` | 字典、集合、f-string 插值 | `{"name": "小明"}` |

### 1. 圆括号 `()`：函数与计算

```python
print("Hello Python")
print(len("Python"))

result = (2 + 3) * 4
print(result)
```

**运行结果：**

```text
Hello Python
6
20
```

圆括号也常用于元组：

```python
point = (3, 5)
single = (3,)  # 单元素元组需要逗号
```

### 2. 方括号 `[]`：列表、索引与切片

```python
scores = [88, 92, 76]
print(scores[0])
print(scores[1])

scores[0] = 95
print(scores)
print(scores[0:2])
```

**运行结果：**

```text
88
92
[95, 92, 76]
[95, 92]
```

**记住：** Python 的索引从 `0` 开始；切片 `[0:2]` 包含起点，不包含终点。

### 3. 花括号 `{}`：字典、集合与 f-string

**字典**保存键值关系：

```python
student = {
    "name": "小明",
    "score": 92
}
print(student["name"])  # 小明
```

**集合**保存不重复的元素：

```python
numbers = {1, 2, 2, 3}
print(len(numbers))  # 3
```

**f-string** 使用花括号插入变量：

```python
name = "小明"
score = 92
print(f"{name}的成绩是{score}分")
# 小明的成绩是92分
```

> **注意：** 空的 `{}` 是空字典，空集合应使用 `set()`。

---

## 二、冒号、逗号与点号

| 符号 | 常见作用 | 示例 |
| --- | --- | --- |
| `:` | 开始代码块、分隔字典键值、切片 | `if score >= 60:` |
| `,` | 分隔元素、参数、元组项 | `print("成绩", 92)` |
| `.` | 访问属性与方法 | `scores.append(95)` |

### 1. 冒号 `:`

```python
score = 92

if score >= 60:
    print("考试通过")

student = {"name": "小明", "score": 92}

numbers = [10, 20, 30, 40]
print(numbers[1:3])
```

**运行结果：**

```text
考试通过
[20, 30]
```

这里的冒号分别表示：`if ...:` 引出代码块、字典中的键值分隔，以及 `[1:3]` 的切片范围。

### 2. 逗号 `,`

```python
name = "小明"
age = 18

print(name, age)
scores = [88, 92, 76]
point = 3, 5
```

`print(name, age)` 会输出 `小明 18`。另外，`point = 3, 5` 实际上创建了一个元组。

### 3. 点号 `.`

```python
name = "python"
print(name.upper())
print(name.capitalize())

scores = [88, 92]
scores.append(95)
print(scores)
```

**运行结果：**

```text
PYTHON
Python
[88, 92, 95]
```

> **小提醒：** 点号 `.` 用于访问方法，圆括号 `()` 用于调用方法。

---

## 三、赋值与比较符号

| 符号 | 作用 | 示例 |
| --- | --- | --- |
| `=` | 赋值 | `score = 92` |
| `==` | 判断相等 | `score == 92` |
| `!=` | 判断不相等 | `score != 60` |
| `>` | 大于 | `score > 60` |
| `<` | 小于 | `score < 60` |
| `>=` | 大于等于 | `score >= 60` |
| `<=` | 小于等于 | `score <= 100` |

### 重点：`=` 和 `==` 不一样

```python
score = 92           # 赋值
print(score == 92)   # 判断是否相等
print(score != 92)
```

**运行结果：**

```text
True
False
```

`=` 用来把值存入变量；`==` 用来比较左右两边的值。比较结果一般是 `True` 或 `False`。

```python
score = 92

if score >= 60:
    print("通过")
else:
    print("未通过")
```

**运行结果：**

```text
通过
```

---

## 四、数学运算符号

| 符号 | 作用 | 例子 | 结果 |
| --- | --- | --- | --- |
| `+` | 加法 | `3 + 2` | `5` |
| `-` | 减法 | `3 - 2` | `1` |
| `*` | 乘法 | `3 * 2` | `6` |
| `/` | 普通除法 | `5 / 2` | `2.5` |
| `//` | 向下取整除法 | `5 // 2` | `2` |
| `%` | 取余数 | `5 % 2` | `1` |
| `**` | 幂运算 | `2 ** 3` | `8` |

```python
a = 10
b = 3

print(a + b)
print(a // b)
print(a % b)
print(a ** b)
```

**运行结果：**

```text
13
3
1
1000
```

`%` 常用于判断奇偶数：

```python
number = 8
print(number % 2 == 0)  # True
```

**特别注意：** `//` 是向下取整，`-5 // 2` 的结果是 `-3`。

---

## 五、引号、井号与缩进

### 1. 单引号 `'...'` 与双引号 `"..."`

```python
name = "小明"
message = '你好，Python'

print(name)
print(message)

sentence = "It's Python"
print(sentence)
```

单引号和双引号都能创建字符串。字符串内部包含单引号时，可以在外层使用双引号。

### 2. 井号 `#`：注释

```python
# 定义学生成绩
score = 92
print(score)  # 输出成绩
```

注释有助于阅读代码，Python 不会执行井号后面的注释文字。

### 3. 缩进：决定代码块范围

```python
score = 92

if score >= 60:
    print("通过")
    print("继续努力")

print("程序结束")
```

前两条输出属于 `if` 代码块，最后一条不属于。Python 通常用 **4 个空格**作为一级缩进。

> **记忆：** 冒号引出代码块，缩进决定哪些语句属于它。

---

## 六、逻辑运算与成员判断

| 关键字 | 作用 | 示例 |
| --- | --- | --- |
| `and` | 两个条件都满足 | `age >= 18 and score >= 60` |
| `or` | 至少有一个条件满足 | `score >= 90 or score < 60` |
| `not` | 取反 | `not (score < 60)` |
| `in` | 判断元素是否属于某个集合或序列 | `92 in scores` |

```python
age = 18
score = 92

print(age >= 18 and score >= 60)
print(score >= 90 or score < 60)
print(not (score < 60))
```

**运行结果：**

```text
True
True
True
```

成员判断的例子：

```python
scores = [88, 92, 76]
print(92 in scores)
print(60 in scores)
```

**运行结果：**

```text
True
False
```

---

## 七、其他值得认识的符号

| 符号 | 常见用途 | 示例 |
| --- | --- | --- |
| `+=` | 在原值上增加 | `score += 5` |
| `-=` | 在原值上减少 | `score -= 5` |
| `\n` | 字符串中的换行 | `"第一行\n第二行"` |
| `\` | 转义特殊字符 | `"He said \"Hi\""` |
| `*` | 除乘法外，还可展开序列 | `print(*[1, 2, 3])` |
| `;` | 分隔同一行多条语句 | `a = 1; b = 2` |

### 复合赋值 `+=`

```python
score = 90
score += 5

print(score)  # 95
```

这相当于 `score = score + 5`。

### 转义字符 `\n`

```python
print("第一行\n第二行")
print("He said \"Hi\"")
```

**运行结果：**

```text
第一行
第二行
He said "Hi"
```

### 再看一次 f-string `{变量}`

```python
number = 1
score = 92

print(f"第{number}位：{score}分")
# 第1位：92分
```

---

## 八、最后总结：按类别记忆

| 类别 | 常见符号 | 核心作用 |
| --- | --- | --- |
| **括号** | `()`、`[]`、`{}` | 调用函数、列表与字典、插入变量 |
| **代码结构** | `:`、`,`、缩进 | 代码块、数据分隔 |
| **对象访问** | `.` | 访问属性或方法 |
| **赋值与比较** | `=`、`==`、`!=`、`>`、`<` | 赋值、判断关系 |
| **数学计算** | `+`、`-`、`*`、`/`、`//`、`%`、`**` | 加减乘除、取余与幂 |
| **字符串与注释** | `'`、`"`、`#`、`\` | 定义字符串、注释与转义 |
| **逻辑判断** | `and`、`or`、`not`、`in` | 多条件判断、查找元素 |

初学阶段优先掌握四组区别：**`=` 与 `==`、`()` 与 `[]`、`/` 与 `//`、`:` 与缩进**。理解它们后，学习条件判断、循环与列表会轻松很多。

### 小练习：猜猜运行结果

```python
scores = [88, 92, 76]
number = 2

print(scores[1])
print(number % 2 == 0)
print(f"第{number}位：{scores[1]}分")
```

<details>
<summary>点击查看答案</summary>

```text
92
True
第2位：92分
```

`scores[1]` 是列表中的第 2 个元素；`2 % 2` 为 0；f-string 会把花括号中的值插入字符串。

</details>

最好的学习方式，是每遇到一个符号，就亲手写一段简短代码并检查输出。**先理解作用，再熟悉组合使用。**
