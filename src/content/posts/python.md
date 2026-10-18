---
title: "2026 Python 模拟题逐题答案与解析"
published: 2026-10-18
description: "Python 模拟题逐题答案与解析，包含顺序结构、while 循环、for 循环三大类型"
category: "python"
draft: false
tags: ["python"]
slug: "python"
---
---

 2026 Python 模拟题逐题答案与解析  
  
包含顺序结构、while 循环、for 循环三大类型

---

## 解题方法对照模板

### 顺序结构模板

- 判断题眼：只有“输入、计算、输出”，没有 if/elif/else，也没有 for/while。
- 常用答案：`input`、`int`、`float`、`print`、`//`、`%`、`**`、变量名。
- 口诀：输入要转换；求商/十位用 `//`；求余/个位/整除/奇偶用 `%`；平方/立方用 `**` 或连乘；最后输出变量。

### while 循环模板

- 判断题眼：先给初值，再写 `while 条件:`，循环体里会修改变量。
- 常用答案：`while`、比较符、累加语句、更新语句。
- 口诀：看初值、看条件、看循环体、看变量每次加几或减几；求和初值 `0`，求积初值 `1`。

### for 循环模板

- 判断题眼：已知范围、次数或序列，常出现 `for ... in range(...)`。
- 常用答案：`for`、`in`、`range`、起点、终点、步长、累加/累乘表达式。
- 口诀：`range(起点, 终点, 步长)` 包含起点、不包含终点；想取到 n，终点写 n+1。

### if-else 选择结构模板

- 判断题眼：需要判断条件、分情况输出或计算。
- 常用答案：`if`、`elif`、`else`、`and`、`or`、`==`、`!=`、比较符。
- 口诀：第一种情况 `if 条件:`；中间情况 `elif 条件:`；最后剩余情况 `else:`；同时满足用 `and`，满足其一用 `or`。

具体请阅读 [2026 Python 程序设计](python)

## 第一章 顺序结构

### 第一章-1

- 题目关键词：求立方体体积
- 题目：

```python
a=float(①("请输入正方形的边长："))
v=a*a*a
print(②)     # 输出立方体的体积
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `v`
- 解析：看到“请输入/输入”时，按模板填 input。

</details>

### 第一章-2

- 题目关键词：求圆环面积
- 题目：

```python
r1=float(input("请输入大圆的半径："))
r2=①(input("请输入小圆的半径："))
s1=3.14*r1*r1
s2=3.14*r2*r2
s=②
print("圆环的面积是：",s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `s1-s2`
- 解析：题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。圆环面积等于大圆面积减小圆面积，所以填 s1-s2。

</details>

### 第一章-3

- 题目关键词：求梯形面积
- 题目：

```python
a=①(input("请输入梯形的上底："))
b=float(input("请输入梯形的下底："))
h=float(input("请输入梯形的高："))
s=(a+b)*h/2
print("梯形的面积是：",②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `s`
- 解析：题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。

</details>

### 第一章-4

- 题目关键词：华氏温度转摄氏温度
- 题目：

```python
f = ①(input("请输入华氏温度："))
c = 5 / 9 * (f - 32)
print("摄氏温度为：", ②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `c`
- 解析：题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。

</details>

### 第一章-5

- 题目关键词：计算花坛面积
- 题目：

```python
x=①(input("请输入篱笆的长："))
r=x/(2*3.14)
s=3.14*r*r
print("花坛的面积是：",②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `s`
- 解析：题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。

</details>

### 第一章-6

- 题目关键词：男女生比值
- 题目：

```python
s=int(input("请输入学生总数："))
g=①(input("请输入女生人数："))
m=②  # 计算男生人数
a=m/g
print("男女生比值为：",a )
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `s-g`
- 解析：输入的是整数或人数、数量，所以外层用 int()。男生人数=总人数-女生人数，所以填 s-g。

</details>

### 第一章-7

- 题目关键词：求商和余数
- 题目：

```python
a=①(input("请输入a的值："))
b=int(input("请输入b的值："))
s=a//b
y=a②b
print("商是：",s)
print("余数是：",y)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `%`
- 解析：输入的是整数或人数、数量，所以外层用 int()。求余、判断倍数或取个位时用 %。

</details>

### 第一章-8

- 题目关键词：只计算个位上的和
- 题目：

```python
a = int(input("请输入一个整数："))
b = int(input("请输入另一个整数："))
c = a ① 10
d = b % 10
total = (c + d) % 10
print("小强的答案是：", ②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `%`；② `total`
- 解析：求余、判断倍数或取个位时用 %。

</details>

### 第一章-9

- 题目关键词：制作计算器
- 题目：

```python
a = int(①("请输入第一个整数："))
b = int(input("请输入第二个整数："))
sum_result = a + b
difference = a - b
product = a * b
quotient = a ② b
remainder = a % b
print("两数和：", sum_result)
print("两数差：", difference)
print("两数积：", product)
print("两数商：", quotient)
print("两数余数：", remainder)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `//`
- 解析：看到“请输入/输入”时，按模板填 input。整除求商或取十位时用 //。

</details>

### 第一章-10

- 题目关键词：两位数各位数字和
- 题目：

```python
num=int(input("请输入一个两位整数："))
a=num①10
b=num%10
c=a+b
print("个位数加十位数上的和为：",②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `//`；② `c`
- 解析：整除求商或取十位时用 //。两位数十位用 //10，个位用 %10。

</details>

### 第一章-11

- 题目关键词：分跳绳
- 题目：

```python
m=①(input("请输入跳绳根数："))
n=int(input("请输入每班分的根数："))
a=m//n
b=m②n
print("最多可以分给",a,"个班","还剩",b,"根")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `%`
- 解析：输入的是整数或人数、数量，所以外层用 int()。求余、判断倍数或取个位时用 %。

</details>

### 第一章-12

- 题目关键词：两位数加密
- 题目：

```python
n=int(①("请输入一个两位数："))
sw=n ② 10
gw=n%10
mm=gw*10+sw
print("加密后的数字是：",mm)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `//`
- 解析：看到“请输入/输入”时，按模板填 input。整除求商或取十位时用 //。

</details>

### 第一章-13

- 原题类型：顺序结构
- 题目关键词：计算 a\*b
- 题目：

```python
#计算a*b
a=①(input('请输入数值：'))
b=int(②('请输入数值：'))
c=a*b
③(c)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `input`；③ `print`
- 解析：输入的是整数或人数、数量，所以外层用 int()。看到“请输入/输入”时，按模板填 input。最后输出结果或信息时，按模板填 print。

</details>

### 第一章-14

- 原题类型：顺序结构
- 题目关键词：输入爸爸、妈妈、小玉三人的年龄(正整数)，计算输出总年龄和平均年龄，请补全程序
- 题目：

```python
#输入爸爸、妈妈、小玉三人的年龄(正整数)，计算输出总年龄和平均年龄，请补全程序：
ba=int(input("请输入爸爸的年龄："))
ma=int(input("请输入妈妈的年龄："))
yu=int(input("请输入小玉的年龄："))
total=①   #补充完整程序，实现计算总年龄
average=(ba+ma+yu)/3 #补充完整程序，实现计算平均年龄
print("一家人的总年龄是：",②,",一家人的平均年龄是：",average)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `ba+ma+yu`；② `total`
- 解析：根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第一章-15

- 原题类型：顺序结构
- 题目关键词：已知摄氏温度（c）与华氏温度（f）的
- 题目：

```python
#已知摄氏温度（c）与华氏温度（f）的
#转换公式如下：c=5/9*(f-32)，其中，
#c为摄氏温度，f为华氏温度。现在要求
#编写程序将任意输入的华氏温度转换为
#摄氏温度，请补全程序：
f = ①(input("请输入华氏温度："))
c = 5 / 9 * (f - 32)
print("摄氏温度为：", ②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `c`
- 解析：题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。

</details>

### 第一章-16

- 原题类型：顺序结构几何图形
- 题目关键词：已知正方形的边长 a， 求立方体的体积 v，请补全程序
- 题目：

```python
#已知正方形的边长a， 求立方体的体积v，请补全程序：
a=float(①("请输入正方形的边长："))
v=a*a*a      
print(②)     #输出立方体的体积
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `v`
- 解析：看到“请输入/输入”时，按模板填 input。

</details>

### 第一章-17

- 原题类型：顺序结构几何图形
- 题目关键词：梯形面积的求解公式为 s=(a+b)×h/2 ，从键盘读入一个梯形的上底 a 下底 b 和高 h，请计算梯形的面积，请补全程序
- 题目：

```python
#梯形面积的求解公式为 s=(a+b)×h/2 ，从键盘读入一个梯形的上底a下底b和高h，请计算梯形的面积，请补全程序：
a=①(input("请输入梯形的上底："))
b=float(input("请输入梯形的下底："))
h=float(input("请输入梯形的高："))
s=(a+b)*h/2
print("梯形的面积是：",②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `s`
- 解析：题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。

</details>

### 第一章-18

- 原题类型：顺序结构几何图形
- 题目关键词：请输入大圆半径 r1,小圆半径 r2，求出圆环的面积 s，请补完程序
- 题目：

```python
#请输入大圆半径r1,小圆半径r2，求出圆环的面积s，请补完程序：
r1=float(input("请输入大圆的半径："))
r2=①(input("请输入小圆的半径："))
s1=3.14*r1*r1
s2=3.14*r2*r2
s=②
print("圆环的面积是：",s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `s1-s2`
- 解析：题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。圆环面积等于大圆面积减小圆面积，所以填 s1-s2。

</details>

### 第一章-19

- 原题类型：顺序结构几何图形
- 题目关键词：学校有一个圆形花坛，量得花坛周围的篱笆长是 x 米，请问该花坛的面积是多少平方米？提示：（π=3.14），请补全程序
- 题目：

```python
#学校有一个圆形花坛，量得花坛周围的篱笆长是 x 米，请问该花坛的面积是多少平方米？提示：（π=3.14），请补全程序：
x=①(input("请输入篱笆的长："))
r=x/(2*3.14)
s=3.14*r*r
print("花坛的面积是：",②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `s`
- 解析：题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。

</details>

### 第一章-20

- 原题类型：顺序结构运算符号
- 题目关键词：袁老师要求学员们制作一个计算器。
- 题目：

```python
#袁老师要求学员们制作一个计算器。
#其中功能为：输入两个整数，计算并输出两个数的
#和、差、积、商以及余数，请补全程序：
a = int(①("请输入第一个整数："))
b = int(input("请输入第二个整数："))
sum_result = a + b
difference = a - b
product = a * b
quotient = a ② b
remainder = a % b
print("两数和：", sum_result)
print("两数差：", difference)
print("两数积：", product)
print("两数商：", quotient)
print("两数余数：", remainder)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `//`
- 解析：看到“请输入/输入”时，按模板填 input。整除求商或取十位时用 //。

</details>

### 第一章-21

- 原题类型：顺序结构运算符号
- 题目关键词：输入 a,b 两个整数，编程求出 a 除以 b 得到的商和余数，请补全程序
- 题目：

```python
#输入 a,b 两个整数，编程求出a除以b得到的商和余数，请补全程序：
a=①(input("请输入a的值："))
b=int(input("请输入b的值："))
s=a//b 
y=a②b
print("商是：",s)
print("余数是：",y)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `%`
- 解析：输入的是整数或人数、数量，所以外层用 int()。求余、判断倍数或取个位时用 %。

</details>

### 第一章-22

- 原题类型：顺序结构运算符号
- 题目关键词：补全程序
- 题目：

```python
r=float(①("r="))
s=3.14*(r②2)
print("圆的面积是",s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `**`
- 解析：看到“请输入/输入”时，按模板填 input。平方等幂运算用 **。

</details>

### 第一章-23

- 原题类型：顺序结构运算符号
- 题目关键词：学校新买来 m 根跳绳，每个班分 n 根，最多可以分给几个班的同学，还剩多少根？提示：（m≥n），请补全程序
- 题目：

```python
#学校新买来m根跳绳，每个班分n根，最多可以分给几个班的同学，还剩多少根？提示：（m≥n），请补全程序：
m=①(input("请输入跳绳根数："))
n=int(input("请输入每班分的根数："))
a=m//n
b=m②n
print("最多可以分给",a,"个班","还剩",b,"根")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `%`
- 解析：输入的是整数或人数、数量，所以外层用 int()。求余、判断倍数或取个位时用 %。

</details>

### 第一章-24

- 原题类型：顺序结构运算符号
- 题目关键词：小强是一个很懒的人，比如说，计算 3456+38，
- 题目：

```python
#小强是一个很懒的人，比如说，计算3456+38，
#他只会计算个位上的数6+8，对于答案也只记录个位上的数4，
#简单的说，就是只对个位数进行计算。那么对于以下数据，请输出小强的答案，请补全程序：
a = int(input("请输入一个整数："))
b = int(input("请输入另一个整数："))
c = a ① 10
d = b % 10
total = (c + d) % 10
print("小强的答案是：", ②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `%`；② `total`
- 解析：求余、判断倍数或取个位时用 %。

</details>

### 第一章-25

- 原题类型：顺序结构运算符号
- 题目关键词：将一个二位数的十位与个位交换位置进行加密
- 题目：

```python
#将一个二位数的十位与个位交换位置进行加密
n=int(①("请输入一个两位数："))
sw=n②10
gw=n%10
mm=gw*10+sw
print("加密后的数字是",mm)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `//`
- 解析：看到“请输入/输入”时，按模板填 input。整除求商或取十位时用 //。两位数十位用 //10，个位用 %10。

</details>

### 第一章-26

- 题目关键词：已知正方形的边长 a， 求立方体的体积 v，请补全程序
- 题目：

```python
#已知正方形的边长a， 求立方体的体积v，请补全程序：
a=float(①("请输入正方形的边长："))
v=a*a*a
print(②)     #输出立方体的体积
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `v`
- 解析：看到“请输入/输入”时，按模板填 input。

</details>

### 第一章-27

- 题目关键词：请输入大圆半径 r1,小圆半径 r2，求出圆环的面积 s，请补完程序
- 题目：

```python
#请输入大圆半径r1,小圆半径r2，求出圆环的面积s，请补完程序：
r1=float(input("请输入大圆的半径："))
r2=①(input("请输入小圆的半径："))
s1=3.14*r1*r1
s2=3.14*r2*r2
s=②
print("圆环的面积是：",s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `s1-s2`
- 解析：题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。圆环面积等于大圆面积减小圆面积，所以填 s1-s2。

</details>

### 第一章-28

- 题目关键词：输入 a,b 两个整数，编程求出 a 除以 b 得到的商和余数，请补全程序
- 题目：

```python
#输入 a,b 两个整数，编程求出a除以b得到的商和余数，请补全程序：
a=①(input("请输入a的值："))
b=int(input("请输入b的值："))
s=a//b
y=a②b
print("商是：",s)
print("余数是：",y)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `%`
- 解析：输入的是整数或人数、数量，所以外层用 int()。求余、判断倍数或取个位时用 %。

</details>

### 第一章-29

- 题目关键词：梯形面积的求解公式为 s=(a+b)×h/2 ，从键盘读入一个梯形的上底 a 下底 b 和高 h，请计算梯形的面积，请补全程序
- 题目：

```python
#梯形面积的求解公式为 s=(a+b)×h/2 ，从键盘读入一个梯形的上底a下底b和高h，请计算梯形的面积，请补全程序：
a=①(input("请输入梯形的上底："))
b=float(input("请输入梯形的下底："))
h=float(input("请输入梯形的高："))
s=(a+b)*h/2
print("梯形的面积是：",②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `s`
- 解析：题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。

</details>

### 第一章-30

- 题目关键词：已知摄氏温度（c）与华氏温度（f）的转换公式如下：c=5/9\*(f-32)，其中，c 为摄氏温度，f 为华氏温度。现在要求编写程序将任意输入的华氏温度转换为摄氏温度
- 题目：

```python
#已知摄氏温度（c）与华氏温度（f）的转换公式如下：c=5/9*(f-32)，其中，c为摄氏温度，f为华氏温度。现在要求编写程序将任意输入的华氏温度转换为摄氏温度，请补全程序：
f = ①(input("请输入华氏温度："))
c = 5 / 9 * (f - 32)
print("摄氏温度为：", ②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `c`
- 解析：题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。

</details>

### 第一章-31

- 题目关键词：小强是一个很懒的人，比如说，计算 3456+38，他只会计算个位上的数 6+8，对于答案也只记录个位上的数 4，简单的说，就是只对个位数进行计算。那么对于以下数据，请
- 题目：

```python
#小强是一个很懒的人，比如说，计算3456+38，他只会计算个位上的数6+8，对于答案也只记录个位上的数4，简单的说，就是只对个位数进行计算。那么对于以下数据，请输出小强的答案，请补全程序：
a = int(input("请输入一个整数："))
b = int(input("请输入另一个整数："))
c = a ① 10
d = b % 10
total = (c + d) % 10
print("小强的答案是：", ②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `%`；② `total`
- 解析：求余、判断倍数或取个位时用 %。

</details>

### 第一章-32

- 题目关键词：袁老师要求学员们制作一个计算器。其中功能为：输入两个整数，计算并输出两个数的和、差、积、商以及余数，请补全程序
- 题目：

```python
#袁老师要求学员们制作一个计算器。其中功能为：输入两个整数，计算并输出两个数的和、差、积、商以及余数，请补全程序：
a = int(①("请输入第一个整数："))
b = int(input("请输入第二个整数："))
sum_result = a + b
difference = a - b
product = a * b
quotient = a ② b
remainder = a % b
print("两数和：", sum_result)
print("两数差：", difference)
print("两数积：", product)
print("两数商：", quotient)
print("两数余数：", remainder)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `//`
- 解析：看到“请输入/输入”时，按模板填 input。整除求商或取十位时用 //。

</details>

### 第一章-33

- 题目关键词：请从键盘输入一个两位整数，求这个两位整数个位数加十位数上的和是多少？请补全程序
- 题目：

```python
#请从键盘输入一个两位整数，求这个两位整数个位数加十位数上的和是多少？请补全程序：
num=int(input("请输入一个两位整数："))
a=num①10
b=num%10
c=a+b
print("个位数加十位数上的和为：",②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `//`；② `c`
- 解析：整除求商或取十位时用 //。两位数十位用 //10，个位用 %10。

</details>

### 第一章-34

- 题目关键词：学校新买来 m 根跳绳，每个班分 n 根，最多可以分给几个班的同学，还剩多少根？提示：（m≥n），请补全程序
- 题目：

```python
#学校新买来m根跳绳，每个班分n根，最多可以分给几个班的同学，还剩多少根？提示：（m≥n），请补全程序：
m=①(input("请输入跳绳根数："))
n=int(input("请输入每班分的根数："))
a=m//n
b=m②n
print("最多可以分给",a,"个班","还剩",b,"根")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `%`
- 解析：输入的是整数或人数、数量，所以外层用 int()。求余、判断倍数或取个位时用 %。

</details>

### 第一章-35

- 题目关键词：学校有一个圆形花坛，量得花坛周围的篱笆长是 x 米，请问该花坛的面积是多少平方米？提示：（π=3.14），请补全程序
- 题目：

```python
#学校有一个圆形花坛，量得花坛周围的篱笆长是 x 米，请问该花坛的面积是多少平方米？提示：（π=3.14），请补全程序：
x=①(input("请输入篱笆的长："))
r=x/(2*3.14)
s=3.14*r*r
print("花坛的面积是：",②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `s`
- 解析：题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。

</details>

### 第一章-36

- 题目关键词：根据输入的学生总数和女生人数，输出男女生比值
- 题目：

```python
#根据输入的学生总数和女生人数，输出男女生比值
s=int(input("请输入学生总数："))
g=①(input("请输入女生人数："))
m=②  #计算男生人数
a=m/g
print("男女生比值为：",a )
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `s-g`
- 解析：输入的是整数或人数、数量，所以外层用 int()。男生人数=总人数-女生人数，所以填 s-g。

</details>

### 第一章-37

- 题目关键词：输入一个两位数，将其加密后逆序输出。输入一个两位数，将其加密后输出。加密方法：交换输入数的十位与个位上的数字，输出一个新的两位数（如：输入数字 18，输出 81）。
- 题目：

```python
#输入一个两位数，将其加密后逆序输出。输入一个两位数，将其加密后输出。加密方法：交换输入数的十位与个位上的数字，输出一个新的两位数（如：输入数字18，输出81）。
n=int(①("请输入一个两位数："))
sw=n ② 10
gw=n%10
mm=gw*10+sw
print("加密后的数字是：",mm)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `//`
- 解析：看到“请输入/输入”时，按模板填 input。整除求商或取十位时用 //。两位数十位用 //10，个位用 %10。## 第二章 while 循环

</details>

### 第二章-1

- 题目关键词：输出 100 以内所有偶数的和
- 题目：

```python
s=0
a=0
while  a①100:
    ②=s+a
    a=a+③
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `<=`；② `s`；③ `2`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第二章-2

- 题目关键词：while 循环执行后的输出结果
- 备注：该题来自 Word 内嵌图片 image3。
- 题目：

```python
h=1
t=0
while h>=0.2:
    h=h/2
    t=t+1
print(t)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：`3`
- 解析：本题属于 while 循环程序分析。h 从 1 开始每次除以 2：第一次 h=0.5,t=1；第二次 h=0.25,t=2；第三次 h=0.125,t=3，此时 h<0.2 循环结束，所以输出 3。

</details>

### 第二章-3

- 题目关键词：补写循环条件使程序输出 1 到 10
- 备注：该题来自 Word 内嵌图片 image4。
- 题目：

```python
m=1
①
    print(m)
    m=m+1
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `while m<=10:`
- 解析：本题属于 while 循环补条件。m 初始为 1，每轮先输出再 m=m+1，要输出到 10 为止，所以循环条件应写 while m<=10:。

</details>

### 第二章-4

- 原题类型：While 循环
- 题目关键词：计算 1+2+……+100，答案 5050.
- 题目：

```python
#计算1+2+……+100，答案5050.
s=0
a=0
while  a①100:
    ②=s+a
    a=a+③
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `<=`；② `s`；③ `1`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第二章-5

- 原题类型：While 循环
- 题目关键词：计算 100 以内整数的和
- 题目：

```python
#计算100以内整数的和
sum=0
i=1
while i<=100:
    sum=①   
    i=②   
print(sum)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `sum+i`；② `i+1`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第二章-6

- 原题类型：While 循环
- 题目关键词：计算 50 以内所有偶数的和
- 题目：

```python
#计算50以内所有偶数的和
s=0
i=0
①  i<50:
       s=s+i
       i=i+2
②(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `while`；② `print`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。最后输出结果或信息时，按模板填 print。看到“满足条件一直重复”且循环变量在循环体内更新时，用 while。判断偶数看除以 2 的余数是否为 0。

</details>

### 第二章-7

- 原题类型：While 循环
- 题目关键词：以下是计算 s=1+6+11+……+101 的程序，请补充完整该程序
- 题目：

```python
#以下是计算 s=1+6+11+……+101的程序，请补充完整该程序:
s=0
k=1
while k<=101:
    s=①
    k=②
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `s+k`；② `k+5`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第二章-8

- 原题类型：While 循环
- 题目关键词：计算 30 以内（包括 30）所有偶数的和，答案 240.
- 题目：

```python
#计算30以内（包括30）所有偶数的和，答案240.
s=0
a=0
while  a①30:        
   s=s+a
   a=a+2
print("求和为：",②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `<=`；② `s`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。判断偶数看除以 2 的余数是否为 0。

</details>

### 第二章-9

- 原题类型：While 循环
- 题目关键词：输出 20 以内所有奇数的和（让填 while 和 n=n+1)
- 题目：

```python
#输出20以内所有奇数的和（让填while和n=n+1)
n=1
s=0
① n<=20:
    if n%2==1:
        s=s+n
    n=n+②
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `while`；② `1`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。看到“满足条件一直重复”且循环变量在循环体内更新时，用 while。判断奇数看除以 2 的余数是否为 1。

</details>

### 第二章-10

- 原题类型：While 循环
- 题目关键词：妈妈把小明的压岁钱 5000 元存入银行，假设银行利率为 3%，请计算需要多少年达到 8000 元，请补全程序
- 题目：

```python
#妈妈把小明的压岁钱5000元存入银行，假设银行利率为3%，请计算需要多少年达到8000元，请补全程序：

s = 5000
years = 0
while s ① 8000:
    ② = s + s * 0.03
    years = years + 1
print(years, "年后达到8000元")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `<`；② `s`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第二章-11

- 原题类型：While 循环
- 题目关键词：共有 150 吨燃料，一天用掉 2.6 吨，问最多可用几天？
- 题目：

```python
#共有150吨燃料，一天用掉2.6吨，问最多可用几天？
m=150
n=2.6
t=0
while ①>2.6:
    m=m-n
    t+=②
print("最多可以用",t,"天")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `m`；② `1`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第二章-12

- 原题类型：While 循环
- 题目关键词：天然气价格不断攀升，某大型发电厂
- 题目：

```python
#天然气价格不断攀升，某大型发电厂
#的天然气目前有150亿m3库存，
#如果要保持最低的消耗是每天2.6亿m3，
#那么现在的天然气最多可以用多久？
m=150
s=2.6
t=0
while ①>=0:
    m=m-s
    t+=②
print("可以使用",t,"天")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `m-s`；② `1`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第二章-13

- 原题类型：While 循环
- 题目关键词：猜体重游戏(只有 3 次机会):如果猜对了我的体重 65 公斤
- 题目：

```python
#猜体重游戏(只有3次机会):如果猜对了我的体重65公斤
#则输出“恭喜你猜对了”，否则输出“请再猜一次”，请补全并调试程序，以实现其功能，
weight=65   
time=0                     
while  time<3:       
       cai=int(①("我的体重是:"))   
       if  cai②weight:                
           print("恭喜你猜对了")  
           break              
       else:                  
           print("请再猜一次")  
       time=time+1
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `==`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。看到“请输入/输入”时，按模板填 input。break 表示满足条件后立即跳出循环。

</details>

### 第二章-14

- 原题类型：while 循环
- 题目关键词：有一根长 1 米的竹竿，每次折去原来的二分之一，折几次后即可小于原长度的 20%？
- 题目：

```python
h=1
t=0
while  h①0.2:
     h=h②2
     t=③+1
print(t)

#有一根长1米的竹竿，每次折去原来的二分之一，折几次后即可小于原长度的20%？
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `>`；② `/`；③ `t`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第二章-15

- 原题类型：while 循环
- 题目关键词：细菌有很强的繁殖能力，假如一个细菌半小时增加一倍，多长时间这种细菌的数量就会超过现在世界人口（76 亿）。
- 题目：

```python
h=1   #初始细菌数量
t=0 #初始时间（小时）
while h①7600000000:
    h=h②2
    t=t+0.5
print(③)

#细菌有很强的繁殖能力，假如一个细菌半小时增加一倍，多长时间这种细菌的数量就会超过现在世界人口（76亿）。
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `<`；② `*`；③ `t`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第二章-16

- 原题类型：while 循环
- 题目关键词：补全程序
- 题目：

```python
m=12000
s=380
t=0
①  m>=380:
    m=m-s
    t=t+1
print("可以使用",②,"天")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `while`；② `t`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。看到“满足条件一直重复”且循环变量在循环体内更新时，用 while。

</details>

### 第二章-17

- 题目关键词：计算并输出 100（含）以内所有偶数的和。
- 题目：

```python
#计算并输出100（含）以内所有偶数的和。
s=0
a=0
while  a①100:
    ②=s+a
    a=a+③
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `<=`；② `s`；③ `2`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。判断偶数看除以 2 的余数是否为 0。

</details>

### 第二章-18

- 题目关键词：有一根长 1 米的竹竿，每次折去原来的二分之一，折几次后即可小于原长度的 20%？
- 题目：

```python
h=1
t=0
while  h①0.2:
     h=h②2
     t=③+1
print(t)

#有一根长1米的竹竿，每次折去原来的二分之一，折几次后即可小于原长度的20%？
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `>`；② `/`；③ `t`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第二章-19

- 题目关键词：细菌有很强的繁殖能力，假如一个细菌半小时增加一倍，多长时间这种细菌的数量就会超过现在世界人口（76 亿）。
- 题目：

```python
h=1  	#初始细菌数量
t=0	#初始时间（小时）
while h①7600000000:
    h=h②2
    t=t+0.5
print(③)

#细菌有很强的繁殖能力，假如一个细菌半小时增加一倍，多长时间这种细菌的数量就会超过现在世界人口（76亿）。
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `<`；② `*`；③ `t`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第二章-20

- 题目关键词：补全程序
- 题目：

```python
m=12000
s=380
t=0
①  m>=380:
    m=m-s
    t=t+1
print("可以使用",②,"天")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `while`；② `t`
- 解析：本题属于 while 循环。按“初值 → while 条件: → 循环体 → 更新变量”的模板检查。看到“满足条件一直重复”且循环变量在循环体内更新时，用 while。## 第三章 for 循环

</details>

### 第三章-1

- 题目关键词：求 50 内所有能被 9 整除的数之和
- 题目：

```python
s=①
for i in range(9,51,9):
    s=s+②
print("和为：",s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `0`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。累加求和的初值一般设为 0。

</details>

### 第三章-2

- 题目关键词：求 3+6+9+…+300
- 题目：

```python
s = 0
for ① in range(1, 101):
    s=s+3②i
print("结果是：", s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `i`；② `*`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-3

- 题目关键词：输出 20 以内所有能被 5 整除的数的积
- 题目：

```python
s=①
for  i in  range(5,21,5):
    s=s ② i
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `1`；② `*`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-4

- 题目关键词：输出 100 以内能被 9 整除但不能被 7 整除的整数
- 题目：

```python
for i in ①(101):
    if i%9==0 and i%7②0:
        print(i,end=" ")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `!=`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-5

- 题目关键词：求 1-100 的所有奇数和
- 题目：

```python
s=0
for i in  ① (1,101):
    if i%2 ② 1:
        s=s+i
print("1-100奇数和为：",s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `==`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。判断奇数看除以 2 的余数是否为 1。

</details>

### 第三章-6

- 题目关键词：输出可能的密码
- 题目：

```python
for i ①  range(10):
    for j in range(10):
        num = 35009+100*i+10*j
        if num % 9 ② 0:
            print("可能的密码是:",num)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `==`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。for 循环固定搭配是 for 变量 in range(...)。密码比较用 ==，验证失败的分支用 else。

</details>

### 第三章-7

- 原题类型：range 循环取余筛选
- 题目关键词：100 以内能被 3 整除的数
- 题目：

```python
#100以内能被3整除的数
for i in     ①    :
    if      ②     :
           print(i)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range(101)`；② `i%3==0`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。求余、判断倍数或取个位时用 %。range 的终点取不到，要把最后一个需要取到的数顺延一个。

</details>

### 第三章-8

- 原题类型：range 循环取余筛选
- 题目关键词：补全程序
- 题目：

```python
for  i  in  range(1,100):
     if  i%4==0  ①  i%7==0:
           ②("可以同时被4和7整除的数是",i)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `and`；② `print`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。最后输出结果或信息时，按模板填 print。两个条件必须同时成立时用 and。

</details>

### 第三章-9

- 原题类型：range 循环取余筛选
- 题目关键词：找出 100 以内所有能被 5 和 7 整除的数
- 题目：

```python
#找出100以内所有能被5和7整除的数
for x ① range(1,100):
    if x%5==0 ②  x%7==0:
        print(x)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `and`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。两个条件必须同时成立时用 and。for 循环固定搭配是 for 变量 in range(...)。

</details>

### 第三章-10

- 原题类型：range 循环取余筛选
- 题目关键词：输出 100 以内的能被 7 整除但不能被 6 整除的整数
- 题目：

```python
#输出100以内的能被7整除但不能被6整除的整数
for i in range(101):      
    ① i%7==0 and i%6②0:  
        print(i,end=" ")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `if`；② `!=`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。条件判断的开头用 if。

</details>

### 第三章-11

- 原题类型：range 循环取余筛选
- 题目关键词：输出 100 以内能被 9 整除但不能被 7 整除的整数，请补完程序
- 题目：

```python
#输出100以内能被9整除但不能被7整除的整数，请补完程序：
for i in ①(101):
    if i%9==0 and i%7②0:
        print(i,end=" ")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `!=`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-12

- 原题类型：range 循环迭代求和
- 题目关键词：计算 1+2+3+4……+10。答案 55
- 题目：

```python
#计算1+2+3+4……+10。答案55
s=①
for i in range(1,②):
     s=s+③
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `0`；② `11`；③ `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。累加求和的初值一般设为 0。

</details>

### 第三章-13

- 原题类型：range 循环迭代求和
- 题目关键词：计算并输出 1+5+9+13+17+21 的和，答案 66
- 题目：

```python
#计算并输出1+5+9+13+17+21的和，答案66
s=0
for i in range(1,22,①):
   s=s+②
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `4`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-14

- 原题类型：range 循环迭代求和
- 题目关键词：求 20 以内所有奇数的和。答案 100
- 题目：

```python
#求20以内所有奇数的和。答案100
s=0
for i ① range(1,20,②):
    s=s+i
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `2`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。for 循环固定搭配是 for 变量 in range(...)。判断奇数看除以 2 的余数是否为 1。

</details>

### 第三章-15

- 原题类型：range 循环迭代求和
- 题目关键词：300 以内（包括 300）所有能被 3 整除的数的和，答案 15151
- 题目：

```python
#300以内（包括300）所有能被3整除的数的和，答案15151
s=①
for i in range(3,②,3):
   s=s+i
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `0`；② `301`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。累加求和的初值一般设为 0。

</details>

### 第三章-16

- 原题类型：range 循环迭代求和
- 题目关键词：3+7+11+15.......+47
- 题目：

```python
#3+7+11+15.......+47
s=0
for i in range(3,48,①):
   s=s+②
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `4`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-17

- 原题类型：range 循环迭代求和
- 题目关键词：1+4+7......+19
- 题目：

```python
#1+4+7......+19
s=0
for i in ①(1,20,②):
    s=s+i
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `3`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-18

- 原题类型：range 循环迭代求和
- 题目关键词：求 20 以内（包括 20）所有偶数的和
- 题目：

```python
#求20以内（包括20）所有偶数的和
s=0
for  a  ① range(0,21,2):
     s=s+a
②(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `print`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。最后输出结果或信息时，按模板填 print。for 循环固定搭配是 for 变量 in range(...)。判断偶数看除以 2 的余数是否为 0。

</details>

### 第三章-19

- 原题类型：range 循环迭代求和
- 题目关键词：求 20 以内（包括 20）所有偶数的和
- 题目：

```python
#求20以内（包括20）所有偶数的和
sum = 0
for a in      ①    :
        ②   
print(sum)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range(2,21,2)`；② `sum=sum+a`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。range 的终点取不到，要把最后一个需要取到的数顺延一个。判断偶数看除以 2 的余数是否为 0。

</details>

### 第三章-20

- 原题类型：range 循环迭代求和
- 题目关键词：计算出 3+6+9+……+300 之和。
- 题目：

```python
#计算出3+6+9+……+300之和。
s=0
for i in range(1,①):
    s=s+3*②
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `101`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-21

- 原题类型：range 循环迭代求和
- 题目关键词：5+10+15......+500
- 题目：

```python
#5+10+15......+500
s=0
for i in range(1,①):
    s=s+5*②
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `101`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-22

- 原题类型：range 循环迭代求和
- 题目关键词：32+62+92......+482
- 题目：

```python
#32+62+92......+482
s=0
for i ① range(1,17):
     s=s+(30*i)②2
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `+`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。for 循环固定搭配是 for 变量 in range(...)。

</details>

### 第三章-23

- 原题类型：range 循环迭代求和
- 题目关键词：计算 1+1/2+1/3+1/4+……1/10 的和
- 题目：

```python
#计算1+1/2+1/3+1/4+……1/10的和
s=①
for i in ②(1,11):
    s=s+1/i
③(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `0`；② `range`；③ `print`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。最后输出结果或信息时，按模板填 print。已知循环次数或范围时使用 range。累加求和的初值一般设为 0。

</details>

### 第三章-24

- 原题类型：range 循环迭代求和
- 题目关键词：计算 1²+2²+3²…+100²的值，并输出结果。338350
- 题目：

```python
#计算1²+2²+3²…+100²的值，并输出结果。338350
s=①  
for i in range(1,101):
     s=s+i②i
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `0`；② `*`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。累加求和的初值一般设为 0。

</details>

### 第三章-25

- 原题类型：range 循环迭代求和
- 题目关键词：前 n 个自然数的和
- 题目：

```python
#前n个自然数的和
n=int(input("请输入n的值："))
s=0
for i in range(1,①,1 )   :
     ②     
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `n+1`；② `s=s+i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-26

- 原题类型：range 循环迭代求积
- 题目关键词：9！
- 题目：

```python
#9！
p=1 
for i in ①:
  ②
print ("9!=",p)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range(1,10)`；② `p=p*i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。range 的终点取不到，要把最后一个需要取到的数顺延一个。

</details>

### 第三章-27

- 原题类型：range 循环迭代求积
- 题目关键词：计算 2\*3\*4……\*10 的积。答案 3628800
- 题目：

```python
#计算2*3*4……*10的积。答案3628800
s=①
for i in range(2,11):
     s=s*②
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `1`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。累乘求积的初值一般设为 1。

</details>

### 第三章-28

- 原题类型：range 循环迭代求积
- 题目关键词：1\*3\*5......\*11
- 题目：

```python
#1*3*5......*11
s=1
for i in range(1,12,①):
     s=s*②
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `2`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-29

- 原题类型：range 循环迭代求积
- 题目关键词：计算 1\*3\*5\*7\*……\*19
- 题目：

```python
#计算1*3*5*7*……*19
s=①  
for i in range(3,20,2):
    s=s*②    
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `1`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-30

- 原题类型：range 循环综合
- 题目关键词：300 以内所有被 3 整除的数的和
- 题目：

```python
#300以内所有被3整除的数的和
s=0
for i in range(①):
    if i②3==0:
       s=s+i
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `301`；② `%`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。求余、判断倍数或取个位时用 %。

</details>

### 第三章-31

- 原题类型：range 循环综合
- 题目关键词：找出 50 以内所有能被 3 和 5 整除的数的个数
- 题目：

```python
#找出50以内所有能被3和5整除的数的个数
n=0
for x  ①  range(50):
     if  x%3==0  ②  x%5==0:
          n=n+1
print(n)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `and`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。两个条件必须同时成立时用 and。for 循环固定搭配是 for 变量 in range(...)。

</details>

### 第三章-32

- 原题类型：range 循环综合
- 题目关键词：计算出 20 以内（包括 20）所有奇数的和以及所有偶数的和。答案 100,110.
- 题目：

```python
#计算出20以内（包括20）所有奇数的和以及所有偶数的和。答案100,110.
s1=0
s2=0
for i in ①(1,②):
     if i③2==1:
          s1=s1+i    #奇数和
     else:
          s2=s2+i    #偶数和
print("奇数和为：",s1)
print("偶数和为：",s2)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `21`；③ `%`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。求余、判断倍数或取个位时用 %。已知循环次数或范围时使用 range。判断奇数看除以 2 的余数是否为 1。判断偶数看除以 2 的余数是否为 0。

</details>

### 第三章-33

- 原题类型：range 循环综合
- 题目关键词：求 1-2+3-4+5......+99-100
- 题目：

```python
#求1-2+3-4+5......+99-100
s=0
for i in range(1,101):
  if i%2==0:
    s=①    
  else:
    s=②   
print("s=",s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `s-i`；② `s+i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-34

- 原题类型：range 循环嵌套循环
- 题目关键词：已知五位数密码 35\*\*9，这个密码能被 9 整除，找出符合要求的密码
- 题目：

```python
#已知五位数密码35**9，这个密码能被9整除，找出符合要求的密码
for i ①  range(10):
    for j in range(10):
        num = 35009+100*i+10*j
        if num % 9 ② 0:
            print("可能的密码是:",num)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `==`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。for 循环固定搭配是 for 变量 in range(...)。密码比较用 ==，验证失败的分支用 else。

</details>

### 第三章-35

- 原题类型：range 循环嵌套循环
- 题目关键词：已知五位数密码 23\*\*9，这个密码能被 9 整除，找出符合要求的密码
- 题目：

```python
#已知五位数密码23**9，这个密码能被9整除，找出符合要求的密码
for i in range (0,①):
    for j in range (0,②):
        s=2*10000+3*1000+i*100+j*10+9
        if ③%9==0:
            print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `10`；② `10`；③ `s`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。密码比较用 ==，验证失败的分支用 else。

</details>

### 第三章-36

- 原题类型：range 循环嵌套循环
- 题目关键词：有 5 元、2 元、1 元钱共计 50 张（每种面额至少一张），
- 题目：

```python
#有5元、2元、1元钱共计50张（每种面额至少一张），
#总金额为100元，列出所有的组合方案。共计12种方案
for x in ①(1,21):
    for y in range(1,51):
        for z in range(1,51):
            ② 5*x+2*y+z==100 and x+y+z==50:
                ③(x,y,z)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `if`；③ `print`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。最后输出结果或信息时，按模板填 print。条件判断的开头用 if。已知循环次数或范围时使用 range。

</details>

### 第三章-37

- 原题类型：range 循环嵌套循环
- 题目关键词：用 100 钱来买 100 只鸡,计算公鸡、母鸡、小鸡各买多少只。
- 题目：

```python
#用100钱来买100只鸡,计算公鸡、母鸡、小鸡各买多少只。
#假设公鸡一只5钱，母鸡一只3钱，小鸡一钱3只.共计三种方案
for i in range(1, 20):    
    for j in range(1,34):
        for w in range(1,100):
            if ① and ②: 
                print("公鸡、母鸡、小鸡的数量分别是:",i, j, w)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `i+j+w==100`；② `5*i+3*j+w/3==100`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-38

- 原题类型：range 循环嵌套循环
- 题目关键词：用 100 钱来买 100 只鸡,计算公鸡、母鸡、小鸡各买多少只。假设公鸡一只 5 钱，
- 题目：

```python
#用100钱来买100只鸡,计算公鸡、母鸡、小鸡各买多少只。假设公鸡一只5钱，
#母鸡一只3钱，小鸡一钱3只.
for i in range(1, 21):    
    for j in range(1,34):
        if      i*5+j*3+①==100     and       (100-i-j)②3==0    : 
            print("公鸡、母鸡、小鸡的数量分别是:",i, j, ③)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `(100-i-j)/3`；② `%`；③ `100-i-j`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。求余、判断倍数或取个位时用 %。

</details>

### 第三章-39

- 原题类型：range 循环嵌套循环
- 题目关键词：小丽想编写程序，用\*打印一个 5 行的直角三角形，请补充完整程序
- 题目：

```python
#小丽想编写程序，用*打印一个5行的直角三角形，请补充完整程序：
for i in range(1,6):
    ① j in range(1,i+1):
        print("②",end="")
    print()
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `for`；② `*`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-40

- 原题类型：range 循环嵌套循环
- 题目关键词：小明去买文具，铅笔每根 0.5 元，笔记本每本 3.5 元，他带了 30 元钱，请问有几种买法，请补全程序
- 题目：

```python
# 小明去买文具，铅笔每根0.5元，笔记本每本3.5元，他带了30元钱，请问有几种买法，请补全程序：

total = 30
 # 假设铅笔最多可以买m根，笔记本最多可以买n本
for m in range(int(total / 0.5) + 1):  # 因为铅笔每根0.5元所以最多可以买total/0.5根
    for n in range(int(total / 3.5) + 1):  # 笔记本每本3.5元，所以最多可以买total/3.5本
       ① 0.5 * m + 3.5 * n == total:
            print("能买铅笔:", m, "笔记本:", ②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `if`；② `n`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。条件判断的开头用 if。

</details>

### 第三章-41

- 原题类型：循环结构
- 题目关键词：补全程序
- 题目：

```python
for  i  in  ①(1,②):
     print(③*"*")
'''输出如下图案。
*
**
***
****
*****
******'''
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `7`；③ `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-42

- 原题类型：循环结构-迭代求和
- 题目关键词：有一学生在 6 岁时把 2000 块压岁钱买一个基金，如果年收益率为 8%，那么到 18 岁时他能拿到多少钱？
- 题目：

```python
s=2000
① i in ② (6,19):
   s=③*(1+0.08)
print(s)

#有一学生在6岁时把2000块压岁钱买一个基金，如果年收益率为8%，那么到18岁时他能拿到多少钱？
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `for`；② `range`；③ `s`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-43

- 原题类型：循环结构-迭代求和
- 题目关键词：求 4+10+16+22+28+34+40                                        s=①
- 题目：

```python
求4+10+16+22+28+34+40                                        s=①
for i in range(1,②):
    s=s+(4+i*6)
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `4`；② `7`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-44

- 原题类型：循环结构-迭代求和
- 题目关键词：32+62+92+122+……+482                                                             
- 题目：

```python
#32+62+92+122+……+482                                                                 s=0
① i in range(17):
    s=s+(3* i)② 2
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `for`；② `**`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。平方等幂运算用 **。

</details>

### 第三章-45

- 原题类型：循环结构-迭代求和
- 题目关键词：货币是会贬值的，如果把 200 万存入银行，按照今年银行利率 0.378， #货币贬值每年 0.49 计算，他这 200 万在二十年后将变成多少？money=2000000
- 题目：

```python
#货币是会贬值的，如果把200万存入银行，按照今年银行利率0.378， #货币贬值每年0.49计算，他这200万在二十年后将变成多少？money=2000000
r1=0.378
r2=0.49
for  i  in   ①  (20):
     money=money*(1+r1-r2)
print("二十年后有钱",②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `money`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-46

- 原题类型：循环结构-综合
- 题目关键词：补全程序
- 题目：

```python
s=0
for a ① range(21):
    if a%4==0:
        s+=②
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `a`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。for 循环固定搭配是 for 变量 in range(...)。

</details>

### 第三章-47

- 原题类型：循环结构-综合
- 题目关键词：补全程序
- 题目：

```python
sum=0
data=[12,5,9,11,18,2]
for i  ① data :
    if i%2==0:
        sum=sum+②
print(sum)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。for 循环固定搭配是 for 变量 in range(...)。

</details>

### 第三章-48

- 原题类型：循环结构-综合
- 题目关键词：补全程序
- 题目：

```python
n=0
for x in range(1,101):
    ①  x%2==0 and x%3==0 and x%7==0:
        n+=②
print(n)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `if`；② `1`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。条件判断的开头用 if。

</details>

### 第三章-49

- 原题类型：循环结构-综合
- 题目关键词：补全程序
- 题目：

```python
for i in range(3):
       m=①(input("任意输入一个正整数"))
       if  m%23==0  ② m%37==0:
              print("该数可以被23和37整除",m)
       else:
              print("输入下一个数")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `and`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。输入的是整数或人数、数量，所以外层用 int()。两个条件必须同时成立时用 and。

</details>

### 第三章-50

- 原题类型：循环结构-综合
- 题目关键词：补全程序
- 题目：

```python
for i in ①(3):
     s=int(input("请输入你的学号："))
     if  s%2②0:
             print("女性")
     else:
             print("男性")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `==`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-51

- 原题类型：循环结构-综合
- 题目关键词：补全程序
- 题目：

```python
s=0
for i in range(3):
    t=float(input("评委打分为："))
    s+=①
s=s/3
②  s>85:
    print("作品被选为优秀参赛作品")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `t`；② `if`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。条件判断的开头用 if。

</details>

### 第三章-52

- 原题类型：循环结构-综合
- 题目关键词：Python 循环可以使用 break 语句终止循环并跳出循环，下面是一个计数程序，当遇到 4 时终止循环并跳出循环。
- 题目：

```python
cnt=0
for i in ①(6):
      if i==4:
            break
      cnt=cnt+②
print(cnt)

#Python循环可以使用break语句终止循环并跳出循环，下面是一个计数程序，当遇到4时终止循环并跳出循环。
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。break 表示满足条件后立即跳出循环。

</details>

### 第三章-53

- 原题类型：循环结构-综合
- 题目关键词：补全程序
- 题目：

```python
n="2164"
for i  in range(3):
    m=input("请输入一个四位数密码")
    if  n①m:
         print("密码正确，欢迎回家")
         break      #终止循环结束程序
    ②:
         print("密码不正确，请重新输入")
    if  i==2:
         print("你已经输入三次，系统已被锁")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `==`；② `else`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。最后一种情况不再写条件，直接用 else:。break 表示满足条件后立即跳出循环。密码比较用 ==，验证失败的分支用 else。

</details>

### 第三章-54

- 原题类型：循环结构-嵌套循环
- 题目关键词：共有 14 个小学生搬 38 捆书，男生每人搬 3 捆，女生每人搬 2 捆，如果一次性搬完，需要几个男生和几个女生？
- 备注：（已补足③：条件同时满足人数和捆数，应填 and。）
- 题目：

```python
for i  ① range(1,14):
    for ② in range(1,14):
            if i+j==14 ③ i*3+j*2==38:
                 print(i,j)
#共有14个小学生搬38捆书，男生每人搬3捆，女生每人搬2捆，如果一次性搬完，需要几个男生和几个女生？
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `j`；③ `and`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。两个条件必须同时成立时用 and。for 循环固定搭配是 for 变量 in range(...)。

</details>

### 第三章-55

- 原题类型：循环结构-嵌套循环
- 题目关键词：输出 100 以内所有满足 a 小于 b 的勾股数。（勾股数指满足 a×a+b×b=c×c 的自然数）。
- 备注：（已补足③：输出勾股数需调用 print。）
- 题目：

```python
for a in ①(1,101):
    for b in range(1,101):
        for c in range(1,101):
            if  a*a+b*b==c*c  and  a②b:
                ③(a,b,c)
#输出100以内所有满足a小于b的勾股数。（勾股数指满足a×a+b×b=c×c的自然数）。
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `<`；③ `print`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。最后输出结果或信息时，按模板填 print。已知循环次数或范围时使用 range。

</details>

### 第三章-56

- 题目关键词：输出 100 以内能被 9 整除但不能被 7 整除的整数，请补完程序
- 题目：

```python
#输出100以内能被9整除但不能被7整除的整数，请补完程序：
for i in ①(101):
    if i%9==0 and i%7②0:
        print(i,end=" ")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `!=`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-57

- 题目关键词：补全程序
- 题目：

```python
for  i  in  ①(1,②):
     print(③*"*")
'''输出如下图案。
*
**
***
****
*****
******'''
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `7`；③ `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-58

- 题目关键词：补全程序
- 题目：

```python
for i in ①(1,7):
    print(②*"*")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-59

- 题目关键词：有一学生在 6 岁时把 2000 块压岁钱买一个基金，如果年收益率为 8%，那么到 18 岁时他能拿到多少钱？
- 题目：

```python
s=2000
① i in ② (6,19):
   s=③*(1+0.08)
print(s)

#有一学生在6岁时把2000块压岁钱买一个基金，如果年收益率为8%，那么到18岁时他能拿到多少钱？
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `for`；② `range`；③ `s`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-60

- 题目关键词：补全程序
- 题目：

```python
s=①
for i in range(1,②):
    s=s+(4+i*6)
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `4`；② `7`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-61

- 题目关键词：2+5+8+11+……+50
- 题目：

```python
#2+5+8+11+……+50                                                                                  
s=0
① i in range(17):
    s=s+(3* i)② 2
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `for`；② `+`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-62

- 题目关键词：补全程序
- 题目：

```python
money=2000000
r1=0.378
r2=0.49
for  i  in   ①  (20):
     money=money*(1+r1-r2)
print("二十年后有钱",②)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `money`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-63

- 题目关键词：补全程序
- 题目：

```python
s=0
for a ① range(21):
    if a%4==0:
        s+=②
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `a`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。for 循环固定搭配是 for 变量 in range(...)。

</details>

### 第三章-64

- 题目关键词：补全程序
- 题目：

```python
sum=0
data=[12,5,9,11,18,2]
for i  ① data :
    if i%2==0:
        sum=sum+②
print(sum)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。for 循环固定搭配是 for 变量 in range(...)。

</details>

### 第三章-65

- 题目关键词：求 50 内所有能被 9 整除的数之和，请补全程序
- 题目：

```python
#求50内所有能被9整除的数之和，请补全程序：
s=①
for i in range(9,51,9):
    s=s+②
print("和为：",s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `0`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。累加求和的初值一般设为 0。

</details>

### 第三章-66

- 题目关键词：补全程序
- 题目：

```python
n=0
for x in range(1,101):
    ①  x%2==0 and x%3==0 and x%7==0:
        n+=②
print(n)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `if`；② `1`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。条件判断的开头用 if。

</details>

### 第三章-67

- 题目关键词：补全程序
- 题目：

```python
for i in range(3):
       m=①(input("任意输入一个正整数"))
       if  m%23==0  ② m%37==0:
              print("该数可以被23和37整除",m)
       else:
              print("输入下一个数")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `and`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。输入的是整数或人数、数量，所以外层用 int()。两个条件必须同时成立时用 and。

</details>

### 第三章-68

- 题目关键词：求 3+6+9+12+……300 的值，并输出结果，请补全程序
- 题目：

```python
#求3+6+9+12+……300的值，并输出结果，请补全程序：
s = 0
for ① in range(1, 101):
    s=s+3②i
print("结果是：", s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `for`；② `*`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。根据空格前后的语法位置判断应填的关键字、运算符或变量名。

</details>

### 第三章-69

- 题目关键词：补全程序
- 题目：

```python
for i in ①(3):
     s=int(input("请输入你的学号："))
     if  s%2②0:
             print("女性")
     else:
             print("男性")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `==`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-70

- 题目关键词：补全程序
- 题目：

```python
s=0
for i in range(3):
    t=float(input("评委打分为："))
    s+=①
s=s/3
②  s>85:
    print("作品被选为优秀参赛作品")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `t`；② `if`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。条件判断的开头用 if。

</details>

### 第三章-71

- 题目关键词：Python 循环可以使用 break 语句终止循环并跳出循环，下面是一个计数程序，当遇到 4 时终止循环并跳出循环。
- 题目：

```python
cnt=0
for i in ①(6):
      if i==4:
            break
      cnt=cnt+②
print(cnt)

#Python循环可以使用break语句终止循环并跳出循环，下面是一个计数程序，当遇到4时终止循环并跳出循环。
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `i`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。break 表示满足条件后立即跳出循环。

</details>

### 第三章-72

- 题目关键词：补全程序
- 题目：

```python
n="2164"
for i  in range(3):
    m=input("请输入一个四位数密码")
    if  n①m:
         print("密码正确，欢迎回家")
         break      #终止循环结束程序
    ②:
         print("密码不正确，请重新输入")
    if  i==2:
         print("你已经输入三次，系统已被锁")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `==`；② `else`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。最后一种情况不再写条件，直接用 else:。break 表示满足条件后立即跳出循环。密码比较用 ==，验证失败的分支用 else。

</details>

### 第三章-73

- 题目关键词：共有 14 个小学生搬 38 捆书，男生每人搬 3 捆，女生每人搬 2 捆，如果一次性搬完，需要几个男生和几个女生？
- 题目：

```python
for i  ① range(1,14):
    for ② in range(1,14):
            if i+j==14 ③ i*3+j*2==38:
                 print(i,j)
#共有14个小学生搬38捆书，男生每人搬3捆，女生每人搬2捆，如果一次性搬完，需要几个男生和几个女生？
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `j`；③ `and`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。两个条件必须同时成立时用 and。for 循环固定搭配是 for 变量 in range(...)。

</details>

### 第三章-74

- 题目关键词：输出 100 以内所有满足 a 小于 b 的勾股数。（勾股数指满足 a×a+b×b=c×c 的自然数）。
- 题目：

```python
for a in ①(1,101):
    for b in range(1,101):
        for c in range(1,101):
            if  a*a+b*b==c*c  and  a②b:
                ③(a,b,c)
#输出100以内所有满足a小于b的勾股数。（勾股数指满足a×a+b×b=c×c的自然数）。
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `<`；③ `print`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。最后输出结果或信息时，按模板填 print。已知循环次数或范围时使用 range。

</details>

### 第三章-75

- 题目关键词：输出 20（含 20）以内所有能被 5 整除的数的积
- 题目：

```python
#输出20（含20）以内所有能被5整除的数的积
s=①
for  i in  range(5,21,5):
    s=s ② i
print(s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `1`；② `*`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。累乘求积的初值一般设为 1。

</details>

### 第三章-76

- 题目关键词：输出 100 以内能被 9 整除但不能被 7 整除的整数，请补完程序
- 题目：

```python
#输出100以内能被9整除但不能被7整除的整数，请补完程序：
for i in ①(101):
    if i%9==0 and i%7②0:
        print(i,end=" ")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `!=`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。

</details>

### 第三章-77

- 题目关键词：编程计算 1-100 的所有奇数和
- 题目：

```python
#编程计算1-100的所有奇数和
s=0
for i in  ① (1,101):
    if i%2 ② 1:   #判断是否为奇数，如果 i除以2的余数 等于 1
        s=s+i
print("1-100奇数和为：",s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `range`；② `==`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。已知循环次数或范围时使用 range。判断奇数看除以 2 的余数是否为 1。

</details>

### 第三章-78

- 题目关键词：求 10 以内数的平方和
- 题目：

```python
#求10以内数的平方和
s=0
for n ① range(1,11):
    s=s+n*n
print("s=", ② )
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `s`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。for 循环固定搭配是 for 变量 in range(...)。

</details>

### 第三章-79

- 题目关键词：输出可能的密码。行李箱的密码是个五位数且是 9 的倍数。万位为 3，千位为 5，个位为 9，其中百位和十位未知。例：35\*\*9。输出可能的密码。
- 题目：

```python
#输出可能的密码。行李箱的密码是个五位数且是9的倍数。万位为3，千位为5，个位为9，其中百位和十位未知。例：35**9。输出可能的密码。
for i ①  range(10):
    for j in range(10):
        num = 35009+100*i+10*j
        if num % 9 ② 0:
            print("可能的密码是:",num)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `in`；② `==`
- 解析：本题属于 for 循环。按模板 for 变量 in range(起点, 终点, 步长):，注意 range 包含起点、不包含终点。for 循环固定搭配是 for 变量 in range(...)。两位数十位用 //10，个位用 %10。密码比较用 ==，验证失败的分支用 else。## 第四章 if-else 选择结构

</details>

### 第四章-1

- 题目关键词：根据分数评定奖项
- 题目：

```python
score = int(input("请输入小丽的分数："))
if score ①90:
    print("恭喜你获得一等奖！")
elif score >= 80:
    print("恭喜你获得二等奖！")
elif score >= 60:
    print("恭喜你获得三等奖！")
②:
    print("请努力学习，争取下次获奖！")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `>=`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-2

- 题目关键词：判断正数、负数或零
- 题目：

```python
a=float(input("请输入一个数："))
if a①0:
    print("输入的数是正数")
elif a<0:
    print("输入的数是负数")
②:
    print("输入的数是0")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `>`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-3

- 题目关键词：7 的倍数或末尾是 7
- 题目：

```python
a=int(input("请输入一个整数："))
if a%7==0 ① a%10==7:
    print("Yes")
else:
    ②("No")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `or`；② `print`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后输出结果或信息时，按模板填 print。两个条件满足其一即可时用 or。

</details>

### 第四章-4

- 题目关键词：英语成绩等级
- 题目：

```python
a=int(①("请输入英语成绩："))
if a>=90:
    print("A")
② a>=80:
    print("B")
elif a>=70:
    print("C")
elif a>=60:
    print("D")
else:
    print("E")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `elif`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。多分支中间档位用 elif。

</details>

### 第四章-5

- 题目关键词：闰年判断
- 题目：

```python
year = ①(input("请输入4位整数年份: "))
if (year % 4 == 0 and year %100 != 0) ② (year % 400 == 0):
    print(year, "是闰年")
else:
    print(year, "不是闰年")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `or`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。输入的是整数或人数、数量，所以外层用 int()。两个条件满足其一即可时用 or。闰年条件是“四年一闰且百年不闰”或“四百年再闰”，中间应连接 or。

</details>

### 第四章-6

- 题目关键词：用户名和密码验证
- 题目：

```python
name=input("请输入用户名：")
passwd= ① ("请输入密码：")
②  name=="admin" and passwd=="#T123":
    print("信息正确")
else:
    print("信息不正确")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `if`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。条件判断的开头用 if。密码比较用 ==，验证失败的分支用 else。

</details>

### 第四章-7

- 题目关键词：根据流程图判断输出
- 备注：该题来自 Word 内嵌图片 image1。
- 题目：

```python
流程图：输入体温 t；若条件成立输出 "pass"，否则输出 "No pass"。题干：体温超过37.1度的游客不允许通过。
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：`t<=37.1`
- 解析：本题属于选择结构。题干说体温超过 37.1 度不允许通过，因此允许通过并输出 pass 的条件是 t<=37.1。

</details>

### 第四章-8

- 题目关键词：输入 A、B、C 后流程图输出什么
- 备注：该题来自 Word 内嵌图片 image2。
- 题目：

```python
流程图：输入 A、B、C；判断 A>=B，若否则执行 A=B+2*C；输出 A。给定输入：A=-1，B=4，C=2。
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：`8`
- 解析：本题属于选择结构流程图题。代入 A=-1、B=4、C=2，判断 A>=B 不成立，所以执行 A=B+2\*C=4+2\*2=8，最后输出 A 的值 8。

</details>

### 第四章-9

- 原题类型：选择结构两个分支
- 题目关键词：补全程序
- 题目：

```python
n=①("请输入密码：")
if  n=="123asd":
    print("密码正确")
②:
    print("密码不正确")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。最后一种情况不再写条件，直接用 else:。密码比较用 ==，验证失败的分支用 else。

</details>

### 第四章-10

- 原题类型：选择结构两个分支
- 题目关键词：每年 3 月 5 日为学雷锋活动纪念日，输入日期，输出回答正误
- 题目：

```python
#每年3月5日为学雷锋活动纪念日，输入日期，输出回答正误
day="3月5日"
rq=input("请输入日期（X月X日）：")
if  rq①day:             
    print("回答正确")
②:                
    print("对不起答错了！再想想！")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `==`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-11

- 原题类型：选择结构两个分支
- 题目关键词：输入两个数值，如果两个数相等，则计算两个数的乘积，如果不相等，则计算两个数的和。
- 题目：

```python
#输入两个数值，如果两个数相等，则计算两个数的乘积，如果不相等，则计算两个数的和。
a=int(input("请输入a的值："))
b=int(input("请输入b的值："))
if a①b:
    c=a*b
else:
    c=a+b
②(c)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `==`；② `print`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后输出结果或信息时，按模板填 print。

</details>

### 第四章-12

- 原题类型：选择结构两个分支
- 题目关键词：一位整数数字解密，加密数字是 m，解密后变成 n
- 题目：

```python
#一位整数数字解密，加密数字是m，解密后变成n
#解密的规则是：0解密成1、1解密成2、2解密成3……、8解密成9、9解密成0。输出解密数字，请补全程序：

m=int(input("请输入需要解密的一位整数："))   #数字范围0~9
① m==9:
    n=0            #数字0的解密
else:
    n=m+1          #数字0~8解密后增加1   
print(②)          #输出解密数字
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `if`；② `n`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。条件判断的开头用 if。

</details>

### 第四章-13

- 原题类型：选择结构比较运算符
- 题目关键词：该程序的功能是：计算并输出整数的绝对值。请补全并调试程序，以实现其功能。
- 题目：

```python
#该程序的功能是：计算并输出整数的绝对值。请补全并调试程序，以实现其功能。
a=①(input('请输入一个整数：'))
if a<=0:
    print(-a)
②:
    print(a)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。输入的是整数或人数、数量，所以外层用 int()。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-14

- 原题类型：选择结构比较运算符
- 题目关键词：输入两个不同的整数，输出较大值。
- 题目：

```python
#输入两个不同的整数，输出较大值。
a=int(input('请输入a的数值：'))
b=int(①('请输入b的数值：'))
if a②b :
    print("最大的数是：",a)
else:
    print("最大的数是：",③)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `>`；③ `b`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。先比较两个数得到候选值，再与第三个数比较。

</details>

### 第四章-15

- 原题类型：选择结构比较运算符
- 题目关键词：从键盘输入一个正整数，判断是否为奇数，如果是输出“Yes”，否则输出“No”，请补全程序
- 题目：

```python
#从键盘输入一个正整数，判断是否为奇数，如果是输出“Yes”，否则输出“No”，请补全程序：
a=int(①("请输入一个正整数："))
if a%2②0:
    print("Yes")
else:
    print("No")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `!=`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。判断奇数看除以 2 的余数是否为 1。

</details>

### 第四章-16

- 原题类型：选择结构逻辑运算符
- 题目关键词：name=input(“请输入用户名：”)
- 题目：

```python
name=input("请输入用户名：")
passwd=input("请输入密码：")
①  name=="admin" ② passwd=="123":
    print("密码正确")
else:
    print("密码不正确")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `if`；② `and`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。两个条件必须同时成立时用 and。条件判断的开头用 if。密码比较用 ==，验证失败的分支用 else。

</details>

### 第四章-17

- 原题类型：选择结构逻辑运算符
- 题目关键词：判断一个整数能不能同时被 3 和 7 整除。
- 题目：

```python
#判断一个整数能不能同时被3和7整除。
n=int(①('请输入一个整数：'))
if n%3==0 ② n%7==0:
   print("yes")
else:
   print("no")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `and`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。两个条件必须同时成立时用 and。

</details>

### 第四章-18

- 原题类型：选择结构逻辑运算符
- 题目关键词：从键盘上输入一个整数，判断这个数是否为 7 的倍数，或者末尾含有 7 的数。
- 题目：

```python
#从键盘上输入一个整数，判断这个数是否为7的倍数，或者末尾含有7的数。
#例如： 7，14，17，21，27，28  如果是，则输出yes； 如果不是，则输出no，请补全程序：
a=int(input("请输入一个整数："))
if a%7==0 ① a%10==7:
    print("Yes")
else:
    ②("No")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `or`；② `print`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后输出结果或信息时，按模板填 print。两个条件满足其一即可时用 or。

</details>

### 第四章-19

- 原题类型：选择结构多个分支
- 题目关键词：该程序的功能是：某路段限行 40 公里，如果超过 60 公里将被认定超速同时被罚款。
- 题目：

```python
#该程序的功能是：某路段限行40公里，如果超过60公里将被认定超速同时被罚款。
x=int(①("请输入速度："))
if x<=40:
     print('该路段限速40，请注意慢行！')
elif 40<x<60:
     print("你已超速请慢行！")
②:
    print('你已超速，将被记录并罚款！')
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-20

- 原题类型：选择结构多个分支
- 题目关键词：下面是李明同学编写的判断一个数是否为正数、负数或零的程序，请你帮他补充完整程序
- 题目：

```python
#下面是李明同学编写的判断一个数是否为正数、负数或零的程序，请你帮他补充完整程序:
a= ① (input("请输入一个数a："))
if a>0:
    print("a是一个正数")
elif a<0:
    print("a是一个负数")
 ② :
     print("a等于0")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float int   两个答案都算对`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-21

- 原题类型：选择结构多个分支
- 题目关键词：补全程序
- 题目：

```python
x=int(①('输入成绩：'))
if  x>=85:
    ②("优秀")
elif  x>=60:
    print("合格")
③:
    print("不合格")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `print`；③ `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。最后输出结果或信息时，按模板填 print。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-22

- 原题类型：选择结构多个分支
- 题目关键词：补全程序
- 题目：

```python
x=int(input("请输入x的值："))
y=①(input("请输入y的值："))
② x>y:
    print(x,"大于",y)
elif x<y:
    print(x,"小于",y)
③:
    print(x,"等于",y)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `if`；③ `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。输入的是整数或人数、数量，所以外层用 int()。最后一种情况不再写条件，直接用 else:。条件判断的开头用 if。

</details>

### 第四章-23

- 原题类型：选择结构多个分支
- 题目关键词：tw=float(①(“请输入你的体温：”))
- 题目：

```python
tw=float(①("请输入你的体温："))
if  tw>=37.3:
           print("你的体温过高")
②  tw<35:
           print("你的体温过低")
else:
           print("你的体温正常")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `elif`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。多分支中间档位用 elif。

</details>

### 第四章-24

- 原题类型：选择结构多个分支
- 题目关键词：该程序要解决的问题是：某个电信公司推出新套餐，如果
- 题目：

```python
#该程序要解决的问题是：某个电信公司推出新套餐，如果
#每个月流量超过100G就给出降速提醒，超过200G就因流量不足
#提醒购买。请补全并调试程序，以实现其功能。
x=int(input("x="))
if x>=200:
           print("您的流量不足,请及时购买!")
① 200>x>=100:
           print("您的流量将会降速，请谨慎使用!")
②:
           print("您流量充足请放心使用！")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `elif`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。多分支中间档位用 elif。

</details>

### 第四章-25

- 原题类型：选择结构多个分支
- 题目关键词：补全程序
- 题目：

```python
s=eval(①('请输入出租车行驶的公里数:'))
if s<=3:
   p=8
②   3<s<=6:
   p=8+1.5*(s-3)
③:
   p=2.25*(s-6)+1.5*3+8
print(p)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `elif`；③ `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。最后一种情况不再写条件，直接用 else:。多分支中间档位用 elif。

</details>

### 第四章-26

- 原题类型：选择结构多个分支
- 题目关键词：下面是“口语测试成绩评价”程序，请你补充完整该程序
- 题目：

```python
#下面是“口语测试成绩评价”程序，请你补充完整该程序:
g=int(input('please input score:'))
if  ①  :             #分数大于等于90分时输出Great
    print('Great')
elif g>=60 and g<90:
    print('Good')
②:
    print('Bad')
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `g>=90`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-27

- 原题类型：选择结构多个分支
- 题目关键词：补全程序
- 题目：

```python
x=int(input("请输入速度："))
if  x<=110:
    print("该路段限速110，请注意安全驾驶！")
① 110<x<121:
     print("你已超速请慢行！")
else:
     print("你时速是",②,"已超速，将被记录并罚款！")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `elif`；② `x`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。多分支中间档位用 elif。

</details>

### 第四章-28

- 原题类型：选择结构多个分支
- 题目关键词：补全程序
- 题目：

```python
n=int(input("请输入购买的数量："))
if  n<30:
     m=2.0
elif  n<50:
     m=1.8
①  n<100:
     m=1.6
else:
     m=1.5
print("请付款",②*n,"元。")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `elif`；② `m`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。多分支中间档位用 elif。

</details>

### 第四章-29

- 原题类型：拓展
- 题目关键词：输入三个数值，从中选中最大值并输出结果。
- 题目：

```python
#输入三个数值，从中选中最大值并输出结果。
a=int(input("请输入第一个数值："))
b=int(input("请输入第二个数值："))
c=int(input("请输入第三个数值："))
if a①b:
    s=a
else:
    s=b

if s②c:
    s=c
③("最大值为：",s)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `>`；② `<`；③ `print`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后输出结果或信息时，按模板填 print。先比较两个数得到候选值，再与第三个数比较。

</details>

### 第四章-30

- 原题类型：选择结构
- 题目关键词：补全程序
- 题目：

```python
n=int(input("请输入一个三位数："))
s=n//10
①  s②2==0:
    print("该数十位上的数字是偶数")
else:
    print("该数十位上的数字是奇数")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `if`；② `%`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。求余、判断倍数或取个位时用 %。条件判断的开头用 if。判断奇数看除以 2 的余数是否为 1。判断偶数看除以 2 的余数是否为 0。

</details>

### 第四章-31

- 原题类型：选择结构
- 题目关键词：统计小组数量
- 题目：

```python
#统计小组数量
s=int(input("总人数为："))
x= ①(input("每组人数为："))
if s%x ==0:
    a=s//x
else:
    a=s//x+1
print("可以分的小组数量为：", ② )
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `a`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。输入的是整数或人数、数量，所以外层用 int()。

</details>

### 第四章-32

- 原题类型：选择结构
- 题目关键词：补全程序
- 题目：

```python
n=int(input("输入已闯关数"))
r=int(input("输入r的值"))
if r==0:
    print("闯关成功")
①:
    m②                #将n赋值给m
    print("继续努力",m)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `else`；② `=n`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-33

- 原题类型：选择结构
- 题目关键词：判断是否为闰年(四年一闰，百年不闰，四百年再闰）
- 备注：（已校正：原表答案列疑似写成 and，按闰年条件应为 or。）
- 题目：

```python
#判断是否为闰年(四年一闰，百年不闰，四百年再闰）
year = ①(input("请输入4位整数年份: "))
if (year % 4 == 0 and year %100 != 0) ② (year % 400 == 0):
    print(year, "是闰年")
else:
    print(year, "不是闰年")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `or`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。输入的是整数或人数、数量，所以外层用 int()。两个条件满足其一即可时用 or。闰年条件是“四年一闰且百年不闰”或“四百年再闰”，中间应连接 or。

</details>

### 第四章-34

- 原题类型：选择结构
- 题目关键词：求三个数中的最小值，用变量 zx 记录最小值
- 题目：

```python
#求三个数中的最小值，用变量zx记录最小值
x=108
y=55
z=99
if x<y:          #判断x是否小于y
    if x①z:      #如果 x小于z
        zx=x     #x最小赋给zx
    else:
        zx=z
②:
    if y<z:
        zx=y
    else:
        zx=z     #z最小赋给zx
print("最小值为",zx)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `<`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。先比较两个数得到候选值，再与第三个数比较。

</details>

### 第四章-35

- 原题类型：选择结构
- 题目关键词：求三个数中的最大值，用变量 zd 记录最大值
- 题目：

```python
#求三个数中的最大值，用变量zd记录最大值
x=108
y=55
z=99
if x>y:        #判断x是否大于y
    if x①z:    #如果 x大于z
        zd=x
    else:
        zd=z   #z最大赋给zd
else:
    if y>z:
        zd=y
    else:
        zd=z   #z最大赋给zd
②("最大值为",zd)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `>`；② `print`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后输出结果或信息时，按模板填 print。先比较两个数得到候选值，再与第三个数比较。

</details>

### 第四章-36

- 题目关键词：补全程序
- 题目：

```python
n=int(input("请输入一个三位数："))
s=n//10
①  s②2==0:
    print("该数十位上的数字是偶数")
else:
    print("该数十位上的数字是奇数")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `if`；② `%`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。求余、判断倍数或取个位时用 %。条件判断的开头用 if。判断奇数看除以 2 的余数是否为 1。判断偶数看除以 2 的余数是否为 0。

</details>

### 第四章-37

- 题目关键词：统计小组数量
- 题目：

```python
#统计小组数量
s=int(input("总人数为："))
x= ①(input("每组人数为："))
if s%x ==0:
    a=s//x
else:
    a=s//x+1
print("可以分的小组数量为：", ② )
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `a`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。输入的是整数或人数、数量，所以外层用 int()。

</details>

### 第四章-38

- 题目关键词：根据小丽的分数评定奖项，请补全程序
- 题目：

```python
# 根据小丽的分数评定奖项，请补全程序：

score = int(input("请输入小丽的分数："))

if score ①90:               # 分数超过90分（含90）
    print("恭喜你获得一等奖！")
elif score >= 80:             # 分数在80到89分之间
    print("恭喜你获得二等奖！")
elif score >= 60:             # 分数在60到79分之间
    print("恭喜你获得三等奖！")
②:                         # 分数不到60
     print("请努力学习，争取下次获奖！")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `>=`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-39

- 题目关键词：补全程序
- 题目：

```python
n=int(input("输入已闯关数"))
r=int(input("输入r的值"))
if r==0:
    print("闯关成功")
①:
    m②                #将n赋值给m
    print("继续努力",m)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `else`；② `=n`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-40

- 题目关键词：请编写判断一个数是否为正数、负数或零的程序，请补全程序
- 题目：

```python
#请编写判断一个数是否为正数、负数或零的程序，请补全程序：
a=float(input("请输入一个数："))
if a①0:
    print("输入的数是正数")
elif a<0:
    print("输入的数是负数")
②:
    print("输入的数是0")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `>`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-41

- 题目关键词：判断是否为闰年
- 题目：

```python
#判断是否为闰年
year = ①(input("请输入4位整数年份: "))
if (year % 4 == 0 and year %100 != 0) ② (year % 400 == 0):
    print(year, "是闰年")
else:
    print(year, "不是闰年")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `or`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。输入的是整数或人数、数量，所以外层用 int()。两个条件满足其一即可时用 or。闰年条件是“四年一闰且百年不闰”或“四百年再闰”，中间应连接 or。

</details>

### 第四章-42

- 题目关键词：求三个数中的最小值，用变量 zx 记录最小值
- 题目：

```python
#求三个数中的最小值，用变量zx记录最小值
x=108
y=55
z=99
if x<y:          #判断x是否小于y
    if x①z:      #如果 x小于z
        zx=x     #x最小赋给zx
    else:
        zx=z
②:
    if y<z:
        zx=y
    else:
        zx=z     #z最小赋给zx
print("最小值为",zx)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `<`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。先比较两个数得到候选值，再与第三个数比较。

</details>

### 第四章-43

- 题目关键词：求三个数中的最大值，用变量 zd 记录最大值
- 题目：

```python
#求三个数中的最大值，用变量zd记录最大值
x=108
y=55
z=99
if x>y:        #判断x是否大于y
    if x①z:    #如果 x大于z
        zd=x
    else:
        zd=z   #z最大赋给zd
else:
    if y>z:
        zd=y
    else:
        zd=z   #z最大赋给zd
②("最大值为",zd)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `>`；② `print`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后输出结果或信息时，按模板填 print。先比较两个数得到候选值，再与第三个数比较。

</details>

### 第四章-44

- 题目关键词：从键盘上输入一个整数，判断这个数是否为 7 的倍数，或者末尾含有 7 的数。
- 题目：

```python
#从键盘上输入一个整数，判断这个数是否为7的倍数，或者末尾含有7的数。
#例如： 7，14，17，21，27，28  如果是，则输出yes； 如果不是，则输出no，请补全程序：
a=int(input("请输入一个整数："))
if a%7==0 ① a%10==7:
    print("Yes")
else:
    ②("No")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `or`；② `print`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后输出结果或信息时，按模板填 print。两个条件满足其一即可时用 or。

</details>

### 第四章-45

- 题目关键词：学生成绩等级，期中考试已经结束了，孟老师要统计班里同学的英语成绩等级，已知英语成绩是百分制，对应等级如下
- 题目：

```python
#学生成绩等级，期中考试已经结束了，孟老师要统计班里同学的英语成绩等级，已知英语成绩是百分制，对应等级如下：
#A级为90分以上（含90分）；
#B级为80~90分之间（含80分）；
#C级为70~80分之间（含70分）；
#D级为60~70分之间（含60分）；
#E级为60分以下，请补全程序：
a=int(①("请输入英语成绩："))
if a>=90:
    print("A")
② a>=80:
    print("B")
elif a>=70:
    print("C")
elif a>=60:
    print("D")
else:
    print("E")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `elif`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。多分支中间档位用 elif。

</details>

### 第四章-46

- 题目关键词：幼儿园入学，小迪在上幼儿园。已知幼儿园的某一小朋友年龄在 3～5 岁。请编写程序，输入年龄，判断其读小班，中班还是大班。如果 3 岁就读 xiaoban，4 岁就读 zhon
- 题目：

```python
#幼儿园入学，小迪在上幼儿园。已知幼儿园的某一小朋友年龄在3～5岁。请编写程序，输入年龄，判断其读小班，中班还是大班。如果3岁就读xiaoban，4岁就读zhongban，5岁就读daban，请补全程序：
a=int(input("请输入一个整数（3-5）："))
if a①3:
    print("xiaoban")
elif a==4:
    print("zhongban")
②:
    print("daban")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `==`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-47

- 题目关键词：猜年龄：小迪是一个小学生，请输入 6 到 12 之间的随机数，程序会告诉玩家猜测是太高还是太低，请补全程序
- 题目：

```python
#猜年龄：小迪是一个小学生，请输入6到12之间的随机数，程序会告诉玩家猜测是太高还是太低，请补全程序：

a=int(input("小迪的年龄是："))
if a==9:
    print("猜对了")
elif a①9:
    print("猜高了")
②:
    print("猜低了")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `>`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-48

- 题目关键词：小明去冷饮店买冰淇淋，如果买 10 个以上或者 10 个，3 元 1 个，10 个以下，4 元 1 个，输入小明买冰淇淋的个数并输出应付金额，请补全程序
- 题目：

```python
#小明去冷饮店买冰淇淋，如果买10个以上或者10个，3元1个，10个以下，4元1个，输入小明买冰淇淋的个数并输出应付金额，请补全程序：
a=int(input("请输入冰淇淋的个数："))
① a>=10:
    q=3*a
else:
    q=②
print("应付金额（元）为：",q)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `if`；② `4*a`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。条件判断的开头用 if。

</details>

### 第四章-49

- 题目关键词：从键盘上输入两个不同的整数求最大值
- 题目：

```python
#从键盘上输入两个不同的整数求最大值
a=int(input("请输入第一个整数："))
b=int(input("请输入第二个整数："))
if   a①b :
    print(b)
② :
    print(a)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `<`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。先比较两个数得到候选值，再与第三个数比较。

</details>

### 第四章-50

- 题目关键词：从键盘任意输入两个整数，如果二个数相同计算两数和，否则计算两数差，并输出。
- 题目：

```python
#从键盘任意输入两个整数，如果二个数相同计算两数和，否则计算两数差，并输出。
a=int(input("请输入数值1："))
b=int(input("请输入数值2："))
if  a==b:
    c=a+b
① :
    c=a②   
print(c)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `else`；② `-b`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-51

- 题目关键词：判断是否为闰年
- 题目：

```python
#判断是否为闰年
year = ①(input("请输入4位整数年份: "))
if (year % 4 == 0 and year %100 != 0) ② (year % 400 == 0):
    print(year, "是闰年")
else:
    print(year, "不是闰年")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `or`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。输入的是整数或人数、数量，所以外层用 int()。两个条件满足其一即可时用 or。闰年条件是“四年一闰且百年不闰”或“四百年再闰”，中间应连接 or。

</details>

### 第四章-52

- 题目关键词：根据测量指数判断身体属于哪一种体质？输入学生的 BMI 指数，当指数在 18.5kg/m2 以下时输出“消瘦”，在 18.5\~23.9kg/m2 之间（包括边界）为输出“正
- 题目：

```python
#根据测量指数判断身体属于哪一种体质？输入学生的BMI指数，当指数在18.5kg/m2以下时输出“消瘦”，在18.5~23.9kg/m2之间（包括边界）为输出“正常”，在24.0kg/m2及以上输出“超重”。
zs=float(①("请输入你的BMI指数："))
if   zs<18.5:
    print("你的体质为：消瘦")
elif zs<=23.9:
    print("你的体质为：正常")
②:
    print("你的体质为：超重")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。最后一种情况不再写条件，直接用 else:。

</details>

### 第四章-53

- 题目关键词：统计小组数量 二（1）班学生春游需要分成若干小组，根据输入的班级总人数和每小组人数，计算可以分为几个小组？
- 题目：

```python
#统计小组数量 二（1）班学生春游需要分成若干小组，根据输入的班级总人数和每小组人数，计算可以分为几个小组？
s=int(input("总人数为："))
x= ①(input("每组人数为："))
if s%x ==0:
    a=s//x
else:
    a=s//x+1
print("可以分的小组数量为：", ② )
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `int`；② `a`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。输入的是整数或人数、数量，所以外层用 int()。

</details>

### 第四章-54

- 题目关键词：求三个数中的最小值，用变量 zx 记录最小值
- 题目：

```python
#求三个数中的最小值，用变量zx记录最小值
x=108
y=55
z=99
if x<y:          #判断x是否小于y
    if x①z:      #如果 x小于z
        zx=x     #x最小赋给zx
    else:
        zx=z
②:
    if y<z:
        zx=y
    else:
        zx=z     #z最小赋给zx
print("最小值为",zx)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `<`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。先比较两个数得到候选值，再与第三个数比较。

</details>

### 第四章-55

- 题目关键词：求三个数中的最大值，用变量 zd 记录最大值
- 题目：

```python
#求三个数中的最大值，用变量zd记录最大值
x=108
y=55
z=99
if x>y:        #判断x是否大于y
    if x①z:    #如果 x大于z
        zd=x
    else:
        zd=z   #z最大赋给zd
else:
    if y>z:
        zd=y
    else:
        zd=z   #z最大赋给zd
②("最大值为",zd)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `>`；② `print`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后输出结果或信息时，按模板填 print。先比较两个数得到候选值，再与第三个数比较。

</details>

### 第四章-56

- 题目关键词：输入用户名和密码并进行验证。
- 题目：

```python
#输入用户名和密码并进行验证。
name=input("请输入用户名：")
passwd= ① ("请输入密码：")
②  name=="admin" and passwd=="#T123":
    print("信息正确")
else:
    print("信息不正确")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `if`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。条件判断的开头用 if。密码比较用 ==，验证失败的分支用 else。

</details>

### 第四章-57

- 题目关键词：输入出租车行驶的里程数，输出客运费用。输入出租车行驶的里程数，输出客运费用。计费标准如下：3 公里内（含 3 公里），收基础费 8 元；超过 3 公里但未超过 6 公里部分，按 1
- 题目：

```python
#输入出租车行驶的里程数，输出客运费用。输入出租车行驶的里程数，输出客运费用。计费标准如下：3公里内（含3公里），收基础费8元；超过3公里但未超过6公里部分，按1.5元/公里收费；超过6公里部分，按2.25元／公里收费。
s=①(input('请输入出租车行驶的公里数:'))
if s<=3:
   p=8
② s<=6:
   p=8+1.5*(s-3)
else:
   p=2.25*(s-6)+1.5*3+8
print(p)
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `float`；② `elif`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。题目涉及小数、面积、温度或长度，输入后要用 float() 转成小数。多分支中间档位用 elif。

</details>

### 第四章-58

- 题目关键词：输入购买数量，计算费用。根据输入一次性购买作业本的数量，计算输出应付款金额。计价方式为：30 本内按照 2.0 元/本,50 本内按照 1.8 元/本，100 本内按照 1.6
- 题目：

```python
#输入购买数量，计算费用。根据输入一次性购买作业本的数量，计算输出应付款金额。计价方式为：30本内按照2.0元/本,50本内按照1.8元/本，100本内按照1.6元/本，100本及以上按照1.5元/本。
n=int(input("请输入购买的数量："))
if  n<30:
     m=2.0
elif  n<50:
     m=1.8
①  n<100:
     m=1.6
else:
     m=1.5
print("请付款",②*n,"元。")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `elif`；② `m`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。多分支中间档位用 elif。

</details>

### 第四章-59

- 题目关键词：流量信息提醒 电信公司推出流量套餐，根据输入的每个月流量值，输出不同的提示信息。规则：流量超过 100G 时发出降速提醒，超过 200G 时提醒购买。
- 题目：

```python
#流量信息提醒 电信公司推出流量套餐，根据输入的每个月流量值，输出不同的提示信息。规则：流量超过100G时发出降速提醒，超过200G时提醒购买。
x=int(input("x="))
if x>200:
    print("您已使用",x,"G的流量,流量已不足,请及时购买!")
① 200>=x>100:
    print("您已使用",x,"G的流量,将会降速，请谨慎使用!")
②:
    print("您流量充足请放心使用！")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `elif`；② `else`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。最后一种情况不再写条件，直接用 else:。多分支中间档位用 elif。

</details>

### 第四章-60

- 题目关键词：筛选不合格的零部件。针对底面为圆形的部件，根据输入的直径判断该部件是否合格。标准：直径在 99.99\~100.01 毫米之间（包括边界）为合格，否则为不合格。
- 题目：

```python
#筛选不合格的零部件。针对底面为圆形的部件，根据输入的直径判断该部件是否合格。标准：直径在99.99~100.01毫米之间（包括边界）为合格，否则为不合格。
d=float( ① ("请输入精密零部件的直径："))
if d>=99.99  ② d<=100.01:  #部件底面的直径在99.99~100.01毫米之间（包括边界）
    print("该精密部件为：合格")
else:
    print("该精密部件为：不合格")
```

<details data-answer>
<summary>点击查看答案</summary>

- 答案：① `input`；② `and`
- 解析：本题属于选择结构。按模板先写 if 条件:，中间分支写 elif 条件:，最后剩余情况写 else:。看到“请输入/输入”时，按模板填 input。两个条件必须同时成立时用 and。

</details>

