---
title: "Python 列表方法完全教程：添加、删除、查找、排序与复制"
published: 2026-11-02
description: "从零读懂 Python 列表的可变性，逐一掌握 append、extend、insert、pop、remove、clear、index、count、sort、reverse、copy，并解释返回 None 与浅复制。"
category: "Python"
draft: false
tags: ["Python", "Python 入门", "列表", "列表方法", "可变对象"]
lang: zh-CN
series: "Python·零基础系统课"
seriesOrder: 6
---

> **先修知识**：变量、`[]` 列表、`print()`、`len()`、`if` 和基本循环。若你还不熟悉方括号，请先读[常见符号详解](/posts/Python2/)。

**学完要能独立回答**：什么时候用 `append`、`extend`、`insert`？为什么 `scores = scores.append(95)` 不正确？`pop` 和 `remove` 有什么不同？如何避免复制列表时改坏原数据？

## 一、列表是什么？什么叫“可变”

```python
scores = [78, 90, 84]
print(scores[0])       # 78
print(len(scores))      # 3
scores[1] = 95
print(scores)           # [78, 95, 84]
```

变量 `scores` 指向一个**列表对象**。`scores[1] = 95` 在这个列表中替换第 2 个元素，不需要创建新列表。列表是可变对象；字符串不同，不能直接写 `name[0] = "A"`。

**位置与元素数量不是同一个概念**：三个元素索引为 0、1、2；`len(scores)` 才等于 3。

## 二、先认识“方法”的共同写法

```python
scores = [78, 90]
result = scores.append(84)
print(scores)  # [78, 90, 84]
print(result)  # None
```

`scores` 是列表对象，`.` 用来访问它的方法，`append` 是方法名，`(84)` 传入要处理的元素。

关键区别：

- **原地修改**：`append`、`extend`、`insert`、`remove`、`clear`、`sort`、`reverse` 会修改原列表；这些方法通常返回 `None`。
- **返回信息**：`pop` 返回删掉的元素；`index` 返回索引；`count` 返回次数；`copy` 返回新列表。
- **不修改原列表的函数**：`sorted(scores)` 会返回排序后的**新列表**。

不应该把“方法都会返回改变后的列表”当成规则。初学者最容易写错的是 `scores = scores.append(84)`，这样 `scores` 会变成 `None`。

## 三、添加：append、extend、insert 究竟差在哪

### 1. append：在末尾加“一个元素”

```python
a = [1, 2]
a.append(3)
print(a)        # [1, 2, 3]
a.append([4, 5])
print(a)        # [1, 2, 3, [4, 5]]
```

第二次追加的是**一个列表元素**，所以出现嵌套的 `[4, 5]`。

### 2. extend：把可迭代对象里的元素逐个添加

```python
a = [1, 2]
a.extend([3, 4])
print(a)        # [1, 2, 3, 4]
a.extend("AB")
print(a)        # [1, 2, 3, 4, 'A', 'B']
```

注意：`extend("AB")` 会逐个加入 `"A"` 和 `"B"`，不是加入整段字符串作为一个元素。

### 3. insert：在指定索引前插入

```python
a = ["甲", "丙"]
a.insert(1, "乙")
print(a)        # ['甲', '乙', '丙']
```

`insert(1, "乙")` 的意思是插入到**当前索引 1 的元素之前**；原来的 `"丙"` 向后移动。

| 方法 | 操作 | 对 `[1, 2]` 的结果 |
|---|---|---|
| `append(3)` | 末尾添单个元素 | `[1, 2, 3]` |
| `append([3, 4])` | 末尾添单个列表元素 | `[1, 2, [3, 4]]` |
| `extend([3, 4])` | 展开后逐个追加 | `[1, 2, 3, 4]` |
| `insert(1, 9)` | 索引 1 前插入 | `[1, 9, 2]` |

**注意**：`a + [3, 4]` 返回一个新列表，而 `a.extend([3, 4])` 修改原列表；因此保存结果的写法不同。

## 四、删除：按位置删，还是按值删？

### pop：根据索引删除，并返回被删元素

```python
tasks = ["高数", "英语", "Python"]
removed = tasks.pop(1)
print(removed)  # 英语
print(tasks)    # ['高数', 'Python']
print(tasks.pop())  # Python，默认删除末尾
```

`pop(1)` 删除**索引 1**；`pop()` 默认删除最后一项。空列表执行 `pop()` 会抛出 `IndexError`。

### remove：根据值删除，只删第一次出现的值

```python
tasks = ["高数", "英语", "高数"]
tasks.remove("高数")
print(tasks)  # ['英语', '高数']
```

`remove` 不返回被删除的元素。找不到指定值时会抛出 `ValueError`，可先用 `in` 检查：

```python
if "英语" in tasks:
    tasks.remove("英语")
```

### clear 与 del：分别清空和删除

```python
a = [10, 20, 30]
del a[1]
print(a)  # [10, 30]
a.clear()
print(a)  # []
```

`del` 是 Python **语句**，不是列表方法；可以写 `del a[1:3]` 删除切片范围。`clear()` 清空列表但列表对象仍存在。

## 五、查找与计数：in、index、count

```python
fruits = ["苹果", "香蕉", "苹果"]
print("香蕉" in fruits)      # True
print(fruits.index("苹果"))  # 0
print(fruits.count("苹果"))  # 2
```

- `in` 回答“有没有”；不会因为值不存在而报错。
- `index(value)` 返回**第一次匹配**的索引，不存在时抛出 `ValueError`。
- `count(value)` 返回出现次数，不存在时返回 0。

要找所有匹配的索引，可以使用循环和 `enumerate`，而不是只调用一次 `index`：

```python
for i, item in enumerate(fruits):
    if item == "苹果":
        print(i)  # 分两行输出 0、2
```

## 六、排序：sort、sorted 和 reverse

```python
scores = [92, 75, 88]
scores.sort()
print(scores)   # [75, 88, 92]
scores.sort(reverse=True)
print(scores)   # [92, 88, 75]
```

`sort()` **原地排序**。不能写 `scores = scores.sort()`，否则变量会变成 `None`。

```python
original = [92, 75, 88]
new_scores = sorted(original)
print(original)    # [92, 75, 88]
print(new_scores)  # [75, 88, 92]
```

`sorted` 是独立的内置函数，不需要通过列表点号调用。

`reverse()` 只把当前顺序反转，**不等于按从大到小排序**：

```python
a = [3, 1, 2]
a.reverse()
print(a)  # [2, 1, 3]
```

按长度排序的例子：

```python
words = ["cat", "a", "python"]
words.sort(key=len)
print(words)  # ['a', 'cat', 'python']
```

`key=len` 表示比较元素的**长度**，而不是字母大小。不同类型混合排序可能出错，例如整数与字符串通常不能直接比较大小。

## 七、复制：为什么 b = a 不等于复制？

```python
a = [1, 2]
b = a
b.append(3)
print(a)  # [1, 2, 3]
```

`a`、`b` 指向**同一个列表对象**。要创建一个**新列表**，可以：

```python
a = [1, 2]
b = a.copy()
b.append(3)
print(a)  # [1, 2]
print(b)  # [1, 2, 3]
```

`list(a)`、`a[:]` 也能复制外层列表，但都是**浅复制**。有嵌套列表时，内层仍可能共享：

```python
a = [[1], [2]]
b = a.copy()
b[0].append(99)
print(a)  # [[1, 99], [2]]
```

需要完全独立复制嵌套结构时，可了解标准库 `copy.deepcopy`。此处暂时记住：**复制外层，不保证复制内层**。

## 八、综合练习：整理自己的学习任务

```python
tasks = ["高数", "Python"]
tasks.insert(1, "英语")
tasks.append("工程制图")
finished = tasks.pop(0)

print("已完成：", finished)
print("待完成：", tasks)
print("任务数：", len(tasks))
```

预期输出：

```text
已完成： 高数
待完成： ['英语', 'Python', '工程制图']
任务数： 3
```

这里不涉及自动提交作业，只是管理自己输入的学习清单。

## 九、学完自查：先做再展开

1. `a = [1, 2]`，执行 `a.append([3, 4])` 后是什么？
2. `a = [3, 1, 2]`，`a.reverse()` 是否等于降序排序？
3. `a = [5, 5, 8]`，怎样只删除**第二个位置**的 5？
4. 为什么 `b = a.copy()` 仍可能改变 `a` 中的嵌套列表？

<details class="lesson-check">
<summary>展开参考答案与理由</summary>

1. `[1, 2, [3, 4]]`。`append` 加的是**一个**元素。
2. 不是。结果是 `[2, 1, 3]`；降序用 `a.sort(reverse=True)`。
3. `a.pop(1)` 或 `del a[1]`。`remove(5)` 只会删除第一个匹配值。
4. `copy` 只复制外层列表，嵌套的内层列表对象仍可能共享。

</details>

**继续学习：**[切片完全教程](/posts/python-slicing-complete-guide/)专门解释 `[:]`、`[start:stop:step]` 和切片赋值；[变量、对象与引用](/posts/python-variable-deep-dive/)解释“为什么会共享对象”。
