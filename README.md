[![](https://vsmarketplacebadge.apphb.com/version-short/akiramiyakoda.cppincludeguard.svg)](https://marketplace.visualstudio.com/items?itemName=akiramiyakoda.cppincludeguard)
[![](https://vsmarketplacebadge.apphb.com/downloads-short/akiramiyakoda.cppincludeguard.svg)](https://marketplace.visualstudio.com/items?itemName=akiramiyakoda.cppincludeguard)
[![](https://vsmarketplacebadge.apphb.com/rating-short/akiramiyakoda.cppincludeguard.svg)](https://marketplace.visualstudio.com/items?itemName=akiramiyakoda.cppincludeguard)

# Insert C/C++ Include Guard Macros

The **Insert C/C++ Include Guard Macros** extension enables you to add or remove an include guard to your C/C++ header files in one go.

## Features

* Generates include guard macros from GUID v4, file name or file path.
```C
// GUID v4
#define E8A33412_A210_4F05_99A4_F6E2019B7137
// File name
#define UTILS_H
// File path form the prject root
#define FOO_BAR_UTILS_H
```

* Prevents GUIDs from starting with a decimal number.
```C
// Can prevent ill-formed macros like this.
#define 47A7840C_D31B_4D39_BF77_E5E957F0A97A
```

* Adds a cusomizable prefix and/or suffix to include guard macros.
```C
#define ABC_7FE87DA8_601D_4D8E_AEE5_E6BE6EAB5678_XYZ
```

* Skips comment blocks at the beginning of a file.
```C
/**
 * Copyright (c) 2019 Akira Miyakoda
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */
#ifndef FOO_BAR_UTILS_H     // <- Inserted here.
#define FOO_BAR_UTILS_H
```
