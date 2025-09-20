---
title: '构建PNG解析器：从二进制数据到HDR编辑'
description: 'PNG 支持了 HDR，我们来看看它是如何实现的？同时写一个 PNG 的 HDR 编辑器'
pubDate: '09 20 2025'
---
## 背景
 [W3C PNG V3](https://www.w3.org/TR/2025/REC-png-3-20250624) 支持 HDR、APNG、Exif

> HDR（High Dynamic Range）：一种图形格式，能够存储具有相对较高动态范围的图像，该动态范围类似于或超过人类视觉系统的瞬时动态范围

> 动态范围： 最亮的颜色和最暗的颜色之间的亮度差异。 动态范围以摄影光圈数来衡量。一光圈代表亮度增加一倍。

>Animated PNG (APNG): 
扩展只有静态类型的 PNG，增加基于帧的动画。旨在代替 GIF 格式，支持 24 位的图片和 8 位的透明通道 

民间标准转正了～
APNG 是无损动画序列的良好选择（GIF 性能较差）。AVIF 和 WebP 性能更好，但浏览器支持较少。

> EXIF (Exchangeable image file format) :可交换图像文件格式，记录例如快门速度、光圈和方向 等等拍摄信息和图片属性

## 图片有哪些信息
![](https://cdn.statically.io/gh/Mingaaaaaaa/PictureBed@master/20250913/image.5kp3xa46xnw0.png)
一张图片除了包含每个像素点的数据之外，还有很多和解码、渲染相关的数据

### 图片类型
 | 缩写  | 首次发布 | 类型                  | MIME 类型       | 扩展名                        | 标准 / 开发组织               | 免费性 | 描述 |
|-------|----------|-----------------------|-----------------|-------------------------------|-------------------------------|--------|------|
| ICO   | 1985    | 图标容器（位图 / PNG） | image/x-icon    | .ico                          | Microsoft                     | 免费   | 透明 ✅。适合多尺寸图标（如 favicon）。 |
| GIF   | 1987     | 无损（索引色，支持动画） | image/gif       | .gif                          | CompuServe / 公共领域         | 免费   | 动画 ✅。适合简单动画和低色彩图像。 |
| BMP   | 1987     | 无损 / 通常无压缩      | image/bmp       | .bmp, .dib                    | Microsoft                     | 免费   | 适合兼容性需求，文件大，不适合网络传输。 |
| JPEG  | 1992     | 有损压缩               | image/jpeg      | .jpg, .jpeg, .jfif, .pjpeg, .pjp | ISO/IEC 10918-1             | 免费   | 适合照片类图像，文件小但无透明。 |
| PNG   | 1996     | 无损压缩，支持透明      | image/png       | .png                          | W3C                           | 免费   | 透明 ✅。适合高质量图像和透明需求。 |
| SVG   | 1999     | 矢量（基于 XML）        | image/svg+xml   | .svg                          | W3C                           | 免费   | 透明 ✅ / 动画 ✅。适合图标、UI、图表，支持无限缩放。 |
| WebP  | 2010     | 有损 / 无损、支持动画   | image/webp      | .webp                         | Google                        | 免费   | 透明 ✅ / 动画 ✅。适合替代 JPEG/PNG/GIF，压缩更优。 |
| HEIF  | 2015     | 容器（可存储 HEVC 等） | image/heif, image/heic | .heif, .heic                | MPEG / ISO                    | 部分专利 | 透明 ✅ / 动画 ✅ / HDR ✅。适合高效存储与 HDR 图像，常用于苹果设备。 |
| AVIF  | 2019     | 有损 / 无损、支持动画   | image/avif      | .avif                         | AOMedia（基于 HEIF 容器）     | 免费   | 透明 ✅ / 动画 ✅ / HDR ✅。适合高效压缩、HDR 与透明动画场景。 |

### 图片宽高

### 颜色类型
一种图片格式可能有多种颜色类型，如 PNG 的灰色，彩色，调色盘索引色，带透明彩色等等

### 色彩空间
可以理解为一个三/四维的坐标系，用于准确描述颜色，一个颜色在不同空间有不同表达。常见色彩空间有 sRGB、Display-P3

- 色彩模型：将色彩表示为三个基本成分（红色、绿色和蓝色色彩通道）的混合，产生各种色调。如 RGB、HSL，HWB 等等
- 色彩空间：基于某个色彩模型，定义了的基准，白点，传递函数等等的 “坐标系”
- 色域： 色彩空间能够覆盖的颜色范围

显示器的色彩空间可以通过切换描述文件（ICCP）来调节
![](https://cdn.statically.io/gh/Mingaaaaaaa/PictureBed@master/20250913/image.1byojzd7twg0.webp)



### 像素点颜色数据


### 位深度
一个颜色对应的存储 bit 位数，也可能是 调色盘索引的位数

### 编码解码信息
提取、过滤、压缩、分块等等处理信息

### 图片元数据
1. EXIF（Exchangeable Image File Format）
拍摄参数：快门速度、光圈、ISO、焦距
设备信息：相机品牌、型号、镜头信息
时间信息：拍摄时间、修改时间
GPS信息：经纬度、海拔
DPI信息
2. IPTC 
版权信息：作者、版权声明
描述信息：标题、说明、关键词
新闻相关：记者、编辑、发布机构

3. 其他技术元数据：
ICCP(颜色配置文件)
缩略图数据
文件创建/修改时间

## 数据结构
我们以 PNG 为例子，看看上面的数据是如何存储的.

根据 [PNG标准文档](https://w3c.github.io/png)可以看到，PNG 有数据块的概念，一个图片数据有很多的 chunk 构成。
![](https://cdn.statically.io/gh/Mingaaaaaaa/PictureBed@master/20250913/image.6rxbz1jr2100.webp)

典型的PNG数据包括四部分
- PNG Signature（PNG 签名块，包含 PNG 类型的标识）
- IHDR（图像头部块，包含图片的宽度、高度、位的深度和颜色类型）
- IDAT（图像数据块，像素压缩后的数据）
- IEND（图像结束块，PNG 结束标识）

在此基础上，增加acTL（动画控制块）、fcTL（帧控制块）、fdAT（帧数据块）即为APNG动图格式。

![](https://picx.zhimg.com/v2-901e05b2f400084c0e79996a5232befb_1440w.jpg)

我们使用一些工具查看图片二进制格式,可以看到一些数据
![](https://cdn.statically.io/gh/Mingaaaaaaa/PictureBed@master/20250913/image.6ydt0ptcots0.webp)

当然，想要更丰富的信息，还需要有很多种类型的 chunk 去承载，PNG 将 chunk 分类成了关键块和辅助块，关键块是图像展示的必要信息。
### 关键块 (Critical chunks)

| chunktype | 允许多个 | 可选 | 位置 | 含义 |
|---|---|---|---|---|
| IHDR | 否 | 否 | 第一个 | 图像头：宽、高、位深、颜色类型、压缩/滤波/隔行方式 |
| PLTE | 否 | 是 | 第一个 IDAT 之前 | 调色板（索引色或推荐调色板） |
| IDAT | 是 | 否 | 多个连续 | 图像数据（DEFLATE 压缩流） |
| IEND | 否 | 否 | 最后一个 | 图像结束标记 |

### 辅助块 (Ancillary chunks)

| chunktype | 允许多个 | 位置 | 含义 |
|---|---|---|---|
| acTL | 否 | IDAT 之前 | APNG 动画控制（帧数、循环次数） |
| cHRM | 否 | PLTE 和 IDAT 之前 | 原色与白点的色度坐标 |
| cICP | 否 | PLTE 和 IDAT 之前 | 颜色指示参数（原色、传递函数、矩阵系数的参数化描述，用于HDR等） |
| gAMA | 否 | PLTE 和 IDAT 之前 | 图像伽马（近似传递函数） |
| iCCP | 否 | PLTE 和 IDAT 之前 | 嵌入 ICC 配置文件（与 sRGB 互斥） |
| mDCV | 否 | PLTE 和 IDAT 之前 | 母版显示器色彩体积（原色、白点、最小/最大亮度等，HDR 相关） |
| cLLI | 否 | PLTE 和 IDAT 之前 | 内容亮度级信息（MaxCLL/MaxFALL，HDR 相关） |
| sBIT | 否 | PLTE 和 IDAT 之前 | 每通道有效位数 |
| sRGB | 否 | PLTE 和 IDAT 之前 | 指定 sRGB 与渲染意图（与 iCCP 互斥） |
| bKGD | 否 | PLTE 之后；IDAT 之前 | 建议背景色 |
| hIST | 否 | PLTE 之后；IDAT 之前 | 调色板直方图（各索引出现频次） |
| tRNS | 否 | PLTE 之后；IDAT 之前 | 透明度信息（在无显式 alpha 时提供） |
| eXIf | 否 | IDAT 之前 | EXIF 元数据（拍摄参数、时间、GPS 等） |
| fcTL | 是 | 仅第一个可在 IDAT 之前；其余在 IDAT 之后 | APNG 帧控制（每帧尺寸、位置、延时、处置/混合方式） |
| pHYs | 否 | IDAT 之前 | 像素物理密度/比例（每单位像素数与单位） |
| sPLT | 是 | IDAT 之前 | 建议调色板（含样本与频次） |
| fdAT | 是 | IDAT 之后 | APNG 帧数据（类似 IDAT 的附加帧负载） |
| tIME | 否 | 任意位置 | 最后修改时间（UTC） |
| iTXt | 是 | 任意位置 | 国际化文本（UTF‑8，可含语言/翻译，支持压缩） |
| tEXt | 是 | 任意位置 | 文本键值对（未压缩） |
| zTXt | 是 | 任意位置 | 压缩文本键值对 |

## 编程处理图像（web举例）
我们可以获取图片信息，可视化，编辑吗，做一个 web 简单的编辑器？
### 解码并可视化
查看 hdr APNG 和 exif，
```JS
    parse(buffer) {
        this.fileBuffer = new Uint8Array(buffer);
        this.chunks = [];

        if (!this.validatePNGSignature()) {
            throw new Error('不是有效的PNG文件');
        }

        let offset = 8; // signature len
        while (offset < this.fileBuffer.length) {
            const chunk = this.parseChunk(offset);
            if (!chunk) break;

            this.chunks.push(chunk);
            offset += chunk.totalSize;

            if (chunk.type === 'IEND') break;
        }

        return {
            chunks: this.chunks,
            header: this.header,
            fileSize: this.fileBuffer.length
        };
    }
```

[项目在线地址](https://png-decoder.gh.alplune.top/)

### 新特性的实现 && 所在位置
#### HDR ：
- cICP 实现
![](https://cdn.statically.io/gh/Mingaaaaaaa/PictureBed@master/20250913/revoy-cICP-bt.2020.7h9zu3x6rz80.png)

- iCCP 实现
![](https://cdn.statically.io/gh/Mingaaaaaaa/PictureBed@master/20250913/iccp-hdr.3319fl5faze0.png)

>CICP 最初是为视频工作流程中的色彩空间信号传输而开发的，也用于 HEIF、AVIF 和 JPEG-XL 等图像格式。CICP 更加紧凑，旨在指示特定数学表示的原色、传递函数、矩阵系数和信号量化的使用情况，而 ICC 配置文件最初是为了在不同介质（显示、打印、扫描）之间匹配颜色而创建的。存储空间差距也很大

#### APNG： fcTL、fdAT
![](https://cdn.statically.io/gh/Mingaaaaaaa/PictureBed@master/20250913/APNG-example.pqygupp4fkg.png)


### 编辑图像
我们以修改图片 HDR 效果为例子

PNG 允许使用两种 HDR 格式： HLG 和 PQ [ ITU-R-BT.2100 ]。

我们只需要修改/构建 图片的 cICP 块，就可以使得图片支持 HDR 的功能
>[ITU-R-BT.2100]符合国际电信联盟的标准
ITU-R BT.2100，BT 系列：广播业务（电视）。用于制作和国际节目交换的高动态范围电视图像参数值 。国际电信联盟，2018 年 7 月。网址： https ://www.itu.int/rec/R-REC-BT.2100



## 总结


从 PNG 新规范到图片相关知识，最后动手编辑 PNG 数据，算是从 0 到 1 简单学了一遍。感叹 PNG 良好扩展性的同时，也欣赏它~~被迫~~跟上时代的伟大自救精神～

![](https://www.ctrl.blog/media/image/images-webp-avif-vs-jpeg.544.png)

[项目仓库](https://github.com/Mingaaaaaaa/png-decoder)
## 参考资料

- [PNG Specification (PNG 3rd Edition)](https://www.w3.org/TR/2025/REC-png-3-20250624/) - W3C PNG V3官方规范
- [PNG Specification (W3C Working Draft)](https://w3c.github.io/png/) - W3C PNG工作草案
- [ITU-R BT.2100](https://www.itu.int/rec/R-REC-BT.2100) - 国际电联HDR电视图像参数标准

- [PNG cICP Editor](https://github.com/ProgramMax/png_cicp_editor) - PNG cICP块编辑器开源项目
- [PNG解码编码详解](https://vivaxyblog.github.io/2018/04/05/how-png-decode-and-encode.html) - PNG格式技术细节
- [图片格式详解](https://juejin.cn/post/7160512633132171294#heading-50) - 现代图片格式对比分析

- [PNG格式深入分析](https://zhuanlan.zhihu.com/p/196797277) - PNG数据结构详解
- [图片处理技术探索](https://flyhigher.top/develop/2693.html) - Web图片处理实践
- [PNG维基百科](https://zh.wikipedia.org/wiki/PNG) - PNG格式历史和技术概览
