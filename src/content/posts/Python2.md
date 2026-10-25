---
title: "Python 常见符号详解：从括号到运算符"
published: 2026-10-25
description: "写给 Python 零基础读者：详细讲解括号、点号访问、方法调用、赋值比较、运算、字符串与逻辑判断，附逐行分析和运行练习。"
category: "Python"
draft: false
tags: ["Python基础", "语法符号", "运算符", "编程入门"]
slug: "Python2"
---

# Python 常见符号详解：从括号到运算符

刚开始学习 Python 时，经常会看到 `()`、`[]`、`{}`、`:`、`=`、`==` 等符号。它们决定了**代码如何组织、数据如何存储，以及程序如何进行计算和判断**。

本文不只是列一张“符号是什么意思”的表格，而是按照**这行代码在做什么 → Python 如何执行 → 为什么得到这个结果 → 容易在哪一步出错**的顺序，把常见符号讲明白。

先看一小段代码：

```python
scores = [88, 92]
scores.append(95)
print(scores[1] >= 90)
```

**运行结果：**

```text
True
```

它其实可以拆成五步：

1. `[88, 92]` 创建一个列表，`=` 让变量 `scores` 引用它。
2. `scores.append(95)` 调用列表的添加方法，将 95 放到最后。
3. `scores[1]` 读取第 **2** 个元素，结果为 92。
4. `92 >= 90` 是一个比较，结果为 `True`。
5. `print(...)` 将结果显示出来。

**学习符号的目标，是能够读懂上面这五步，而不仅是记下它们的名称。**

> **输入提醒：** Python 代码使用英文半角符号。`!=` 表示不等于，不能写成数学字符 `≠`；`>=`、`<=` 也不能直接输入 `≥`、`≤`。

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

可以把 `len` 和 `print` 想成两个用途不同的工具：`len("Python")` 先计算字符个数，得到 6，再由 `print(6)` 显示出来。**圆括号在函数名后表示“调用工具”**。

但圆括号也能改变数学计算顺序：

```python
print(2 + 3 * 4)
print((2 + 3) * 4)
```

**运行结果：**

```text
14
20
```

第一行先算乘法；第二行先算括号里的 `2 + 3`，所以得到 20。



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

再把列表想成一排编号的小格子：

| 索引（位置编号） | `0` | `1` | `2` |
| --- | --- | --- | --- |
| 元素值 | `95` | `92` | `76` |

- `scores[0]` 是**读取**第 0 号位置的元素。
- `scores[0] = 95` 是**修改**第 0 号位置的元素。
- `scores[0:2]` 是**取一段元素**，不包含终点位置 2。

虽然三种写法都用了方括号，但要根据**括号所在的位置和后面是否跟着等号**来理解它们的作用。

> **常见错误：** 三个元素只有索引 `0`、`1`、`2`。写 `scores[3]` 读取不存在的位置，就会报 `IndexError`（索引越界）。

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

为什么同样是花括号，写法却不一样？要看它的**使用场景**：

- `student = {"name": "小明"}` 是字典。`"name"` 是**键**，`"小明"` 是这个键对应的**值**。
- `numbers = {1, 2, 3}` 是集合。集合主要关心成员是否存在，不像列表那样通过 `[0]` 取第一个元素。
- `f"你好，{name}"` 出现在 f-string 字符串里。`{name}` 是让 Python 计算变量的值，再放到文字中。

字典的 `student["name"]` 是**通过键找数据**；列表的 `scores[0]` 是**通过索引找数据**。看起来都用了 `[]`，背后的规则却不一样。

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

再看一个能体现缩进作用的反例：

```python
score = 55

if score >= 60:
    print("通过")

print("判断结束")
```

**运行结果：**

```text
判断结束
```

执行时先判断 `55 >= 60`，结果为 `False`，所以 `if` 后面缩进的 `print("通过")` 不执行。最后一条 `print` 没有缩进，不属于 `if` 代码块，因此照常执行。

> **记忆：** 冒号告诉 Python“下面开始一个代码块”，**行首缩进**告诉 Python“哪些语句在这个代码块里”。Python 通常使用 4 个空格作为一级缩进。

### 2. 逗号 `,`

```python
name = "小明"
age = 18

print(name, age)
scores = [88, 92, 76]
point = 3, 5
```

`print(name, age)` 会输出 `小明 18`。另外，`point = 3, 5` 实际上创建了一个元组。

在 `print(name, age)` 中，逗号分隔的是**两个参数**，`print` 默认会在它们之间输出一个空格。在 `[88, 92, 76]` 中，逗号分隔的是**列表元素**。你需要先观察这个逗号处在哪种结构里，才能准确解释它。

另外，不要把英文逗号 `,` 误写成中文逗号 `，`，后者通常不是 Python 要求的分隔符。

### 3. 点号 `.`：不只是“访问”，还要弄懂调用方法

初学时看到 `scores.append(95)`，如果只记住“点号表示访问”，依然可能不理解：**访问了谁？找到了什么？为什么后面有括号？结果保存在哪里？**

#### 第一步：什么是对象与方法？

在 Python 中，字符串 `"python"`、列表 `[88, 92]` 等值，都可以看成不同类型的**对象**。

可以暂时把它们想成不同的工具箱：

- 字符串有转换大小写、去掉首尾空格等功能。
- 列表有添加元素、删除元素、排序等功能。

和对象关联的可调用功能，叫作**方法（method）**。点号 `.` 用来访问对象的成员，而方法名后面的 `()` 才表示**真正调用**。

把 `name.upper()` 分成四部分：

| 部分 | 含义 |
| --- | --- |
| `name` | 变量，指向一个字符串对象 |
| `.` | 从这个对象上访问成员 |
| `upper` | 字符串提供的转大写方法 |
| `()` | 调用这个方法 |

**先记一句：点号负责找到方法，圆括号负责调用。**

#### 第二步：`name.upper()` 如何一步步执行？

```python
name = "python"
new_name = name.upper()

print(new_name)
print(name)
```

**运行结果：**

```text
PYTHON
python
```

一行一行看：

1. `name = "python"`：让 `name` 引用字符串 `"python"`。
2. `name.upper`：访问字符串对象的 `upper` 方法。
3. `name.upper()`：调用方法，**返回一个新的大写字符串** `"PYTHON"`。
4. `new_name = ...`：把这个新字符串保存到 `new_name`。
5. 再打印 `name`，仍然是 `"python"`。

因为 Python 的字符串不能原地修改，`upper()` 只会返回一个新字符串。

一个典型的初学者错误：

```python
name = "python"
name.upper()   # 结果没有保存
print(name)
```

**运行结果：**

```text
python
```

如果想让变量以后引用大写结果，应写成：

```python
name = "python"
name = name.upper()
print(name)  # PYTHON
```

#### 第三步：`scores.append(95)` 为什么又能改变原列表？

```python
scores = [88, 92]
scores.append(95)
print(scores)
```

**运行结果：**

```text
[88, 92, 95]
```

`scores` 是列表，`.` 表示从列表上访问成员，`append` 是**添加元素的方法**，`(95)` 把 95 交给这个方法。与 `upper()` 不同，`append()` **会修改原列表**。

再看一个非常重要的反例：

```python
scores = [88, 92]
result = scores.append(95)

print(scores)
print(result)
```

**运行结果：**

```text
[88, 92, 95]
None
```

`None` 可以先理解为“没有返回一个可用的值”。因此**不要写** `scores = scores.append(95)`，否则 `scores` 会变成 `None`，不再是列表。

> **真正重要的区别：** `upper()` 返回新字符串；`append()` 修改原列表。有些方法返回新值，有些方法修改原对象，学习方法时要弄清两者的区别。

#### 第四步：点号后面不一定有 `()`——属性与方法

**属性**是可以通过点号读到的信息；**方法**是可以调用的功能。例如：

```python
import math

print(math.pi > 3)
print(math.sqrt(9))
```

**运行结果：**

```text
True
3.0
```

`import math` 表示引入 Python 自带的数学模块。可以先把 `math` 看作数学工具箱：

- `math.pi`：访问一个圆周率数值，**不需要调用**。
- `math.sqrt(9)`：找到计算平方根的函数，再调用并传入 9。

严格说，`math.sqrt` 是模块里的函数，`name.upper` 是对象的方法；两者都可以使用点号访问，但不是完全相同的概念。

#### 第五步：点号 `.` 与方括号 `[]` 不是一回事

```python
scores = [88, 92]
student = {"name": "小明", "score": 92}

print(scores[0])
print(student["name"])
```

**运行结果：**

```text
88
小明
```

- `scores[0]`：按**索引**从列表取元素。
- `student["name"]`：按**键**从字典取数据。
- `scores.append(95)`：通过点号**访问并调用列表的方法**。

所以普通字典的 `student["name"]` 不能随意写成 `student.name`。

| 常见误写 | 错误原因 | 正确写法 |
| --- | --- | --- |
| `scores.length` | Python 列表没有这个属性 | `len(scores)` |
| `scores.push(95)` | Python 列表没有 `push` 方法 | `scores.append(95)` |
| `student.name` | 普通字典需要按键取值 | `student["name"]` |
| `name.upper` | 只找到方法，没有调用 | `name.upper()` |
| `scores = scores.append(95)` | `append()` 返回 `None` | 直接 `scores.append(95)` |

访问不存在的属性或方法，通常会出现 `AttributeError`。这时应该检查：**点号左边是什么类型？它是否支持右边的方法名称？**

#### 第六步：连续两个点号，是怎样工作的？

```python
message = "  hello python  "
result = message.strip().upper()

print(result)
print(message)
```

**运行结果：**

```text
HELLO PYTHON
  hello python  
```

`message.strip().upper()` 的顺序是：

1. `strip()` 去掉原字符串**首尾**的空格，返回 `"hello python"`，中间空格仍在。
2. 在返回的新字符串上调用 `upper()`，得到 `"HELLO PYTHON"`。
3. 把最终结果保存到 `result`；原来的 `message` 没有变化。

这叫**链式调用**。怕看不懂时，可以先分成两步：

```python
message = "  hello python  "
cleaned = message.strip()
result = cleaned.upper()
print(result)  # HELLO PYTHON
```

**掌握点号的关键，不是背“访问”两个字，而是每次都问：左边是什么对象？右边是什么方法或属性？调用后返回新值还是修改原数据？**

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

### 还要分清 `!=`、`>` 和 `>=`

`!=` 是两个字符 `!` 与 `=` 组成的“不等于”运算符。

```python
score = 92

print(score != 60)
print(score != 92)
```

**运行结果：**

```text
True
False
```

`True` 和 `False` 叫**布尔值**，可以暂时理解成判断的“是”和“否”，开头字母要大写。

再看边界：

```python
score = 60

print(score > 60)
print(score >= 60)
```

**运行结果：**

```text
False
True
```

`score > 60` 是“严格超过 60”，60 本身不符合；`score >= 60` 是“至少 60”，把 60 也算进去。

**容易写错：** `if score = 60:` 会出现语法错误，因为 `=` 是赋值符号。如果想在 `if` 条件中判断是否等于 60，必须写 `if score == 60:`。

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
