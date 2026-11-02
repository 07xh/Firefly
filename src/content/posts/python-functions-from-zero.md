---
title: "Python 函数从零开始：def、参数、return 与作用域"
published: 2026-11-02
description: "从重复代码为什么需要函数出发，分步骤掌握 def、参数与实参、return、None、局部变量、默认参数和可变列表，附可运行实例与自测。"
category: "Python"
draft: false
tags: ["Python", "Python 入门", "函数", "参数", "return", "作用域"]
lang: zh-CN
series: "Python·零基础系统课"
seriesOrder: 10
---

> **先修知识**：变量、`if`、`for`、列表、缩进。本文避免直接跳到闭包或装饰器；先掌握“定义 → 调用 → 接收结果”这一条主线。

## 一、为什么要写函数？

假设你要多次判断不同的分数有没有达到 60 分。如果每次都复制一个 `if`，代码会越来越难修改。函数就是**给一段可重复使用的逻辑起名字**。

```python
def is_pass(score):
    return score >= 60

print(is_pass(75))  # True
print(is_pass(52))  # False
```

读懂三件事：`def` 表示定义函数；`score` 是函数接收的参数；`return` 把计算结果交回给调用处。

## 二、定义函数时，Python 并不会立刻执行函数体

```python
def greet():
    print("你好")

print("定义完毕")
greet()
greet()
```

输出：

```text
定义完毕
你好
你好
```

**定义**会创建可调用的函数对象，**调用** `greet()` 才真正执行里面的语句。冒号与缩进限定函数体；缩进结束后，下面的语句不再属于这个函数。

## 三、参数和实参：名字相似、身份不同

```python
def add(a, b):
    return a + b

result = add(3, 5)
print(result)  # 8
```

- 在 `def add(a, b)` 中，`a`、`b` 是**形参**，用于函数内部计算。
- 在 `add(3, 5)` 中，`3`、`5` 是调用时提供的**实参**。
- `result` 保存 `return` 返回的结果。

按照位置传参，也可以按名称传参：

```python
print(add(b=5, a=3))  # 8
```

初学时要避免混淆“参数在函数里叫什么”和“调用时实际传了什么”。

## 四、return 和 print 绝不是一回事

```python
def show_double(x):
    print(x * 2)

def get_double(x):
    return x * 2

a = show_double(5)     # 这里会先打印 10
b = get_double(5)      # 这里不会自动打印
print(a)               # None
print(b)               # 10
```

`print` 的作用是**向屏幕输出**；`return` 是**结束这次函数调用，并将结果返回给调用者**。

函数没有明确执行 `return` 时，默认返回 `None`。因此 `print` 输出了数字，不等于这个函数返回了数字。

函数遇到 `return` 后，本次调用会立即结束：

```python
def check_number(x):
    if x < 0:
        return "负数"
    return "非负数"

print(check_number(-2))  # 负数
```

## 五、局部变量：函数里的名字不自动传到外面

```python
def add_one(x):
    y = x + 1
    return y

result = add_one(4)
print(result)    # 5
# print(y)       # NameError，y 只在函数内定义
```

局部变量通常只在函数作用域内存在。需要给外部使用，优先通过 `return` 返回结果，而不是把所有变量都改成全局变量。

同名不代表同一变量：

```python
score = 60

def example():
    score = 90
    print(score)

example()     # 90
print(score)  # 60
```

函数内部赋值创建局部绑定，不会直接覆盖外部的 `score`。

## 六、默认参数：有默认值时可以不传

```python
def greet(name, prefix="你好"):
    return f"{prefix}，{name}"

print(greet("小明"))            # 你好，小明
print(greet("小明", "早上好"))  # 早上好，小明
```

通常把需要传入的参数放前面，有默认值的参数放后面。调用时显式传入就覆盖默认值。

要特别防止**可变默认参数**引起的共享问题：

```python
# 不建议：同一个默认列表可能被多次调用共享
def add_bad(item, items=[]):
    items.append(item)
    return items

print(add_bad("A"))  # ['A']
print(add_bad("B"))  # ['A', 'B']
```

更稳妥的写法：

```python
def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items

print(add_item("A"))  # ['A']
print(add_item("B"))  # ['B']
```

默认参数值在**定义函数时**求值，而不是每次调用都自动重新创建列表。

## 七、可变列表作为参数：修改原列表还是返回新列表？

```python
def add_course(courses, course):
    courses.append(course)  # 修改传进来的列表
    return courses

my_courses = ["高数"]
add_course(my_courses, "Python")
print(my_courses)  # ['高数', 'Python']
```

如果不想修改原列表，应先复制：

```python
def with_course(courses, course):
    result = courses.copy()
    result.append(course)
    return result

old = ["高数"]
new = with_course(old, "Python")
print(old)  # ['高数']
print(new)  # ['高数', 'Python']
```

这正是先学习[变量引用](/posts/python-variable-deep-dive/)和[列表复制](/posts/python-list-methods-complete-guide/)的原因。

## 八、综合例子：统计自己记录的学习成绩

```python
def average(scores):
    if len(scores) == 0:
        return None
    total = 0
    for score in scores:
        total += score
    return total / len(scores)

data = [80, 90, 100]
result = average(data)
if result is None:
    print("暂无成绩")
else:
    print(f"平均分：{result:.1f}")
```

输出：

```text
平均分：90.0
```

过程：先判空；再用循环累加；最后除以元素数量。`None` 在这里代表“没有有效平均值”，而非数字 0。示例仅用于处理自己的练习数据。

## 九、写函数时的六项检查

1. 这一段功能**叫什么**？用明确的动词命名，如 `average`、`get_double`。
2. **输入是什么**？参数数量、类型和缺省值要清楚。
3. **何时执行**？定义时不运行，调用时才运行。
4. **返回什么**？不要把 `print` 当成 `return`。
5. **是否修改外部可变对象**？列表传参时尤其检查。
6. **特殊输入怎么办**？空列表、负数、重复项是否有明确约定？

## 十、练习：先预测，再运行

```python
def add_two(x):
    x = x + 2
    return x

n = 5
m = add_two(n)
print(n, m)
```

**问题 A：**打印什么？函数内部的 `x` 改变了外部的 `n` 吗？

**问题 B：**把 `return x` 改为 `print(x)`，`m` 会是什么？

**问题 C：**你要写一个“输入列表，返回反向的新列表，但不改变原列表”的函数，该怎么写？

<details class="lesson-check">
<summary>展开参考答案</summary>

A：`5 7`。整数不可变，`x = x + 2` 只让局部名 `x` 绑定新值。

B：执行时会打印 7，但 `m` 是 `None`，因为函数没有返回值。

C：

```python
def reversed_copy(items):
    return items[::-1]

a = [1, 2, 3]
b = reversed_copy(a)
print(a)  # [1, 2, 3]
print(b)  # [3, 2, 1]
```

</details>

延伸阅读：[循环结构](/posts/python-loops-deep-dive/) · [切片详解](/posts/python-slicing-complete-guide/) · [布尔值与真假判断](/posts/python-boolean-truthiness-deep-dive/)。
