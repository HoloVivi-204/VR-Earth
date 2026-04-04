# DIGITAL EARTH — Technical Specification
### Three.js WebXR Edition | Platform: Web Browser + Netlify + VR Headset

---

## CÔNG NGHỆ SỬ DỤNG (TECH STACK)

| Vai trò | Công nghệ | Ghi chú |
|---------|-----------|---------|
| **3D Engine** | Three.js | Render quả địa cầu, ánh sáng, shader, WebXR |
| **Build Tool** | Vite | Bundle JS, dev server, hot reload, tối ưu khi deploy |
| **VR Support** | WebXR API | Tích hợp sẵn trong Three.js — không cần thư viện riêng |
| **Ngôn ngữ** | JavaScript (ES6+) | Không dùng TypeScript |
| **Styling** | Vanilla CSS | Chỉ cho UI overlay (nút điều hướng, indicator mode) |
| **Animation** | GSAP | Fade transition 1.5 giây khi chuyển mode |
| **Shader** | GLSL | Viết custom shader cho khí quyển, Oren-Nayar, Rayleigh/Mie |
| **Deploy** | Netlify | Kéo thả thư mục build lên là xong, HTTPS tự động |

> **Lưu ý:** Three.js và Vite là 2 thứ riêng biệt dùng cùng nhau — Three.js là thư viện vẽ 3D, Vite là công cụ build và chạy project.

---

> ## 🗂️ HAI MODE HIỂN THỊ CHÍNH
>
> Toàn bộ hệ thống có **2 mode** mà người dùng có thể toggle qua lại (fade chuyển đổi 1.5 giây):
>
> | Mode | Tên đầy đủ | Mô tả |
> |------|-----------|-------|
> | **Mode 1** | Natural Geography | Trái Đất nhìn như thật từ vũ trụ — texture NASA, địa hình 3D, ánh sáng ngày/đêm, mây vệ tinh |
> | **Mode 2** | Administrative & Social | Bề mặt chuyển tối, nổi lên các lớp dữ liệu con người: biên giới hành chính quốc gia, đường bay, tuyến hàng hải, biểu đồ GDP/dân số 3D |
>
> **Lưu ý tên gọi:** "Administrative" (viết tắt Admin) = dữ liệu **hành chính** (biên giới, thủ đô, quốc kỳ) — không phải "admin hệ thống".

---

## PHẦN 1: QUẢ ĐỊA CẦU — TIÊU CHUẨN TRUE VIEW

**Mục tiêu:** Tái hiện màu sắc Trái Đất như mắt người nhìn thấy từ trạm ISS, loại bỏ hiện tượng "cháy màu" xanh.

---

### 1.1 Thông số Vật lý & Hình học (Core Physics)

| Thông số | Giá trị |
|----------|---------|
| Hình dạng | WGS84 Ellipsoid — bóp dẹt hai cực theo tỷ lệ f = 1/298.257 |
| Bán kính xích đạo | 6,378,137 m |
| Bán kính cực | 6,356,752 m |
| Độ nghiêng trục | 23.44° so với mặt phẳng quỹ đạo |
| Chu kỳ quay | 23 giờ 56 phút 4 giây (86,164.09 giây) = 15.041°/giờ |
| Trọng trường | Tích hợp EGM2008 Geoid để tinh chỉnh độ cao mặt nước biển thực tế |

---

### 1.2 Nguồn Texture & Color Profile

**Nguồn tham khảo chính:** NASA Blue Marble — Next Generation (Visible Earth)

- **Đại dương:** Deep Navy — KHÔNG dùng màu Cyan sáng
  - HEX range: `#000033` đến `#000066`
  - Áp dụng Fresnel Effect theo dữ liệu Bathymetry (GEBCO): nông → xanh lơ, sâu → xanh thẫm
- **Mây:** Opacity thay đổi theo mật độ dữ liệu từ NASA GIBS (Cloud Sprite Layer)
  - Cập nhật 1 lần khi khởi động app, cache localStorage TTL = 3 giờ
  - KHÔNG dùng Volumetric Clouds — quá nặng cho WebXR
- Khử nhiễu khí quyển (Atmospheric Correction) trước khi sử dụng texture

---

### 1.3 Vật liệu PBR (Physically Based Rendering)

- **Albedo** (hệ số phản xạ trung bình): `0.30`
- **Specular Map:** phân biệt vùng nước (Glossy) và đất liền (Matte)
- **Nguồn Ocean Color:** NASA Earth Observations (NEO)

---

### 1.4 Cấu tạo Bề mặt Đa tầng (Surface Layering)

#### Địa hình (Topography)
- Displacement Map 16K từ CGIAR-CSI SRTM 90m
- Shader đẩy khối núi thật (Everest, Andes...) theo dữ liệu độ cao — KHÔNG dán Texture phẳng
- Adaptive LOD: giảm xuống 8K khi detect WebXR mode (`renderer.xr.isPresenting`)

#### Thực vật & Tuyết (Temporal Maps)
- 12 bộ Texture theo tháng từ NASA Visible Earth
- Shader tự động `mix()` màu sắc dựa trên tháng hiện tại — mô phỏng tuyết tan và rừng xanh

#### Thủy văn (Hydrology)
- **Water Mask:** tách vùng nước/đất để xử lý Roughness riêng biệt
- **Sông & Hồ:** mạng lưới từ HydroSHEDS, độ nhám cực thấp để phản chiếu ánh sáng
- **Flow Map:** Vector Flow tạo hiệu ứng nước chảy động (Amazon, Mekong...)
- **Đại dương:** Fresnel Effect + Bathymetry (GEBCO)

---

### 1.5 Khí quyển & Ánh sáng (Atmosphere & Optics)

- GLSL Shader mô phỏng tán xạ Rayleigh (viền xanh khí quyển) và Mie (quầng sáng, độ mờ mây/bụi)
- Đèn đêm (Night Lights): shader kích hoạt ánh sáng thành phố khi vùng quay vào vùng tối
- **No Ambient Light** — không gian vũ trụ hoàn toàn tối nếu không có nguồn sáng trực tiếp

---

### 1.6 Chỉ thị Kỹ thuật Rendering

```javascript
// Linear Rendering
renderer.outputEncoding = THREE.sRGBEncoding;

// ACES Filmic Tone Mapping — giữ chi tiết vùng sáng cao
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Anisotropic Filtering — chống nhòe khi nhìn góc nghiêng VR
texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

// Adaptive Quality cho VR
renderer.xr.addEventListener('sessionstart', () => {
  earthMesh.geometry = lowResGeometry; // 8K thay vì 16K
  shadowMap.mapSize.set(2048, 2048);   // thay vì 4096
});
```

---

## PHẦN 2: CHẾ ĐỘ ADMINISTRATIVE & SOCIAL

> **Đây là Mode 2.** Khi toggle sang mode này, bề mặt Trái Đất fade sang tối trong 1.5 giây, các lớp dữ liệu hành chính và xã hội nổi lên.
>
> - **Administrative (Hành chính):** biên giới quốc gia, tên quốc gia, thủ đô, quốc kỳ, landmarks
> - **Social (Xã hội):** đường bay, tuyến hàng hải, vệ tinh, biểu đồ GDP/dân số

**Mục tiêu:** Giao diện sạch sẽ (Clean), tập trung vào mạng lưới kết nối và dữ liệu tương tác động.

---

### 2.1 Chuyển đổi Mode (Mode Transition)

- Dùng `MeshStandardMaterial` với uniform `uAdminBlend` lerp từ `0 → 1` trong 1.5 giây
- Bề mặt Trái Đất fade từ Natural texture sang Dark base map (`#050A14`)

```javascript
const uAdminBlend = { value: 0.0 };

function switchToAdminMode() {
  gsap.to(uAdminBlend, { value: 1.0, duration: 1.5, ease: 'power2.inOut' });
}
```

---

### 2.2 Đường Biên giới Hành chính (Administrative Borders)

- Dùng `THREE.LineSegments` với `ShaderMaterial` tự viết
- Offset normal `+0.002` đơn vị để tránh z-fighting với địa hình núi
- Màu mặc định: `#00FFAA`, opacity `0.6` — khi hover tăng lên `1.0`
- Nguồn dữ liệu: Natural Earth Admin 0 (Vector GeoJSON)

```glsl
// Z-offset để border không bị núi đè
gl_Position.z -= 0.002 * gl_Position.w;
```

---

### 2.3 Raycasting & Selection

- Pre-bake Country ID Texture 4K: mỗi pixel mang country ID dưới dạng màu RGB
- Nhanh hơn raycasting từng polygon — không tốn CPU mỗi frame
- Trong VR: thay mouse pointer bằng `controller.getWorldDirection()` làm ray direction

```javascript
// PC: mouse raycasting
raycaster.setFromCamera(pointer, camera);

// VR: controller raycasting
const controller = renderer.xr.getController(0);
raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
raycaster.ray.direction.set(0, 0, -1).applyMatrix4(controller.matrixWorld);

const hits = raycaster.intersectObject(earthMesh);
if (hits.length > 0) {
  const uv = hits[0].uv;
  const countryId = sampleCountryIdTexture(uv);
  highlightCountry(countryId);
}
```

---

### 2.4 Billboard Labels (Nhãn thông tin động)

- Dùng `THREE.Sprite` với canvas texture render động
- Lazy instantiation: chỉ tạo khi hover, tự destroy sau 3 giây không tương tác
- Luôn `lookAt(camera.position)` mỗi frame
- Nội dung hiển thị: Tên quốc gia, Thủ đô, Quốc kỳ (emoji flag)

---

### 2.5 Spatial Charts (Biểu đồ 3D)

- Dùng `THREE.CylinderGeometry` scale theo trục Y bằng giá trị dữ liệu
- Cột đặt tại tọa độ GPS thủ đô, project lên mặt cầu
- Dữ liệu: World Bank Open Data API (cache 7 ngày)

```javascript
function latLonToVec3(lat, lon, radius) {
  const phi   = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  );
}
```

---

### 2.6 Mạng lưới Giao thông (Social Layer)

- **Hàng không:** Great Circle Arcs nối sân bay (dữ liệu OpenFlights) + hiệu ứng hạt sáng di chuyển
- **Hàng hải:** Tuyến đường biển với đường kẻ đứt đoạn chuyển động (Dash Offset)
- **Vệ tinh:** ISS + GPS + Starlink di chuyển theo vị trí tính toán từ TLE (CelesTrak)

---

### 2.7 Landmarks 3D

- Mô hình 3D Low-poly tại tọa độ GPS chính xác (UNESCO World Heritage)
- Tháp Eiffel, Kim tự tháp, Landmark 81... hiển thị từ zoom level nhất định

---

## PHẦN 3: MẶT TRĂNG — TIÊU CHUẨN REGOLITH GRAY

**Mục tiêu:** Khắc phục lỗi "Mặt Trăng quá trắng". Thực tế nó rất tối và có màu trung tính.

---

### 3.1 Cơ học Thiên thể & Quỹ đạo

| Thông số | Giá trị |
|----------|---------|
| Khoảng cách trung bình | 384,400 km |
| Perigee (Cận điểm) | ~363,300 km |
| Apogee (Viễn điểm) | ~405,500 km |
| Bán kính trung bình | 1,737.4 km |
| Độ dẹt | ≈ 0 |
| Tidal Locking | Chu kỳ tự quay = Chu kỳ quỹ đạo = 27.32 ngày — Near Side luôn hướng về Trái Đất |
| Độ nghiêng trục | 1.54° |

---

### 3.2 Nguồn Texture & Color Profile

**Nguồn tham khảo:** LROC (Lunar Reconnaissance Orbiter Camera) — WAC Colorized Mosaic 16K

| Vùng | Màu | HEX |
|------|-----|-----|
| True Color (base) | Xám bê tông khô | `#4A4A4A` |
| Maria (Biển) | Xám than tối | `#333333` |
| Highlands (Cao nguyên) | Xám nhạt | `#808080` |

- **Albedo trung bình:** `0.12` — rất tối, KHÔNG dùng giá trị mặc định của Three.js

---

### 3.3 Địa chất & Bề mặt

- Displacement Map từ dữ liệu LOLA (NASA LRO) — dựng hố va chạm (Craters) sắc nét
- Phân vùng rõ: Highlands (sáng, gồ ghề) vs. Maria (tối, phẳng)

---

### 3.4 Shader Model — Oren-Nayar

- **KHÔNG** dùng Phong hay Lambert
- Mặt Trăng là vật thể tán xạ ngược (Back-scattering)
- Shader mô phỏng bề mặt xốp của bụi Regolith: khi ánh sáng chiếu thẳng vào → nhìn phẳng và sáng đều (Opposition Surge)

---

### 3.5 Hệ thống Ánh sáng

- **Hard Shadows:** bóng tối đen tuyệt đối và sắc lẹm (không có khí quyển)
- **Earthshine:** nguồn sáng phụ phản chiếu từ Trái Đất khi Mặt Trăng ở vùng tối (Albedo Earth ≈ 0.30)

---

## PHẦN 4: MẶT TRỜI — TIÊU CHUẨN VISIBLE SPECTRUM

**Mục tiêu:** Sử dụng đúng bước sóng mà mắt người có thể cảm nhận — không dùng ảnh giả màu (False Color).

---

### 4.1 Vật lý Cơ bản

| Thông số | Giá trị |
|----------|---------|
| Bán kính | 696,340 km |
| Nhiệt độ màu | 5,778 K — màu trắng/vàng nhạt |
| Bước sóng | **Chỉ dùng 4,500 Å** (HMI Continuum) |
| Nguồn texture | NASA SDO — HMI Intensitygram |

> ⚠️ **TRÁNH** dùng bước sóng 304 Å (đỏ rực) hay 171 Å (vàng kim) — đó là ảnh tia cực tím, không phải màu thật.

---

### 4.2 Hiệu ứng Quang học

- **Limb Darkening:** vùng rìa tối hơn vùng tâm (Astrophysical Formulae — Limb Darkening Law)
- Texture Photosphere với hiệu ứng hạt (Granulation) và quầng sáng (Corona)
- Bloom, Glow và Lens Flare thực tế
- ACES Filmic Tone Mapping để nén dải sáng — vùng rực nhất vẫn giữ chi tiết bề mặt

---

## PHẦN 5: HỆ THỐNG QUỸ ĐẠO — ORBITAL SIMULATION

> **Chiến lược API:** Gọi API **1 lần duy nhất** khi khởi động để lấy epoch position. Sau đó tính toán vị trí bằng công thức Kepler locally — không cần real-time API.

---

### 5.1 Chiến lược API — One-Shot Init

| Dữ liệu | Gọi API | Sau đó | Cache |
|---------|---------|--------|-------|
| Quỹ đạo (JPL Horizons) | 1 lần khi load | Tính bằng Kepler equations | localStorage 24h |
| Mây (NASA GIBS) | 1 lần khi load | Static texture | localStorage 3h |
| GDP/Dân số (World Bank) | 1 lần khi load | Static data | localStorage 7 ngày |
| TLE Satellite (CelesTrak) | 1 lần khi load | Tính SGP4 locally | localStorage 1h |

---

### 5.2 Data Cache Layer

```javascript
class DataCache {
  constructor(fetchFn, ttlMs, storageKey) {
    this.fetchFn = fetchFn;
    this.ttlMs = ttlMs;
    this.storageKey = storageKey;
  }

  async get() {
    const cached = localStorage.getItem(this.storageKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < this.ttlMs) return data;
    }
    const data = await this.fetchFn();
    localStorage.setItem(this.storageKey, JSON.stringify({ data, timestamp: Date.now() }));
    return data;
  }
}

// Khởi tạo
const orbitalCache   = new DataCache(fetchJPL,        86400000, 'jpl_epoch');
const cloudCache     = new DataCache(fetchGIBS,        10800000, 'gibs_cloud');
const worldBankCache = new DataCache(fetchWorldBank,  604800000, 'wb_stats');
```

---

### 5.3 Tính toán Quỹ đạo bằng Công thức Kepler

- **Trái Đất** quay quanh trục: 15.041°/giờ, vị trí khớp với giờ UTC thực
- **Mặt Trăng** quanh Trái Đất: quỹ đạo elip, nghiêng 5.14° so với mặt phẳng hoàng đạo
- **Trái Đất** quanh Mặt Trời: độ lệch tâm 0.0167, vận tốc 29.78 km/s, khoảng cách 147–152 triệu km

```javascript
function getEarthPosition(timestamp) {
  const J2000 = 2451545.0;
  const JD = timestamp / 86400000 + 2440587.5;
  const T = (JD - J2000) / 36525;

  const M = (357.5291 + 35999.0503 * T) * Math.PI / 180;
  const C = (1.9146 - 0.004817 * T) * Math.sin(M)
          + (0.019993) * Math.sin(2 * M);
  const v = M + C * Math.PI / 180;

  const a = 1.000001018;
  const e = 0.0167086;
  const r = a * (1 - e * e) / (1 + e * Math.cos(v));

  return new THREE.Vector3(
    r * Math.cos(v) * AU_TO_SCENE_UNITS,
    0,
    r * Math.sin(v) * AU_TO_SCENE_UNITS
  );
}
```

---

### 5.4 Object Hierarchy (Three.js Scene Graph)

```
scene
  └── sunMesh                      // Mặt Trời — gốc tọa độ
        └── earthPivot             // Pivot quỹ đạo Trái Đất
              └── earthMesh        // Trái Đất (tự quay)
                    └── moonPivot  // Pivot quỹ đạo Mặt Trăng
                          └── moonMesh  // Mặt Trăng

// Mỗi frame:
function animate(timestamp) {
  earthPivot.position.copy(getEarthPosition(timestamp));
  earthMesh.rotation.y = (timestamp / 86164090) * Math.PI * 2;
  moonPivot.rotation.y = (timestamp / (27.32 * 86400000)) * Math.PI * 2;
  sunLight.position.copy(sunMesh.position.clone().negate());
}
```

---

### 5.5 Đường Ranh giới Ngày/Đêm (Terminator)

- Terminator di chuyển mượt mà theo vận tốc tự quay Trái Đất
- **Civil Twilight** (0° đến -6°): bầu trời xanh đậm/cam
- **Nautical Twilight** (-6° đến -12°): bắt đầu thấy sao
- **Astronomical Twilight** (-12° đến -18°): tối hoàn toàn
- Solar Zenith Angle: tính góc cao Mặt Trời tại tọa độ người dùng trong VR để điều chỉnh màu sắc và độ dài bóng đổ

---

### 5.6 Cơ chế Nhật/Nguyệt thực (Eclipse)

- Shadow Map resolution tối thiểu 4096 cho Sun (giảm 2048 khi VR)
- Raycasting kiểm tra va chạm bóng: khi Nguyệt thực, `lerp()` màu Moon sang đỏ theo độ xuyên Umbra
- Đồng bộ với dữ liệu NASA Eclipse Web Site

```javascript
function checkEclipse(moonPos, earthPos, sunPos) {
  const sunToEarth = earthPos.clone().sub(sunPos).normalize();
  const moonProj = moonPos.clone().sub(sunPos);
  const t = moonProj.dot(sunToEarth);
  const closestPoint = sunPos.clone().add(sunToEarth.multiplyScalar(t));
  const dist = moonPos.distanceTo(closestPoint);
  if (dist < EARTH_RADIUS + MOON_RADIUS) {
    const umbra = dist / EARTH_RADIUS;
    moonMaterial.uniforms.uEclipseFactor.value = THREE.MathUtils.lerp(0, 1, umbra);
  }
}
```

---

## PHẦN 6: TRIỂN KHAI WEBXR

**Platform:** Three.js Web + WebXR API. Headset VR (Quest 2/3) truy cập qua browser.

---

### 6.1 Adaptive Quality System

| Setting | Desktop | WebXR VR (Quest) |
|---------|---------|-----------------|
| Displacement Map | 8K | 4K |
| Shadow Map | 4096px | 2048px |
| Cloud Layer | GIBS Sprite | GIBS Sprite (giữ nguyên) |
| Volumetric Clouds | Không dùng | Không dùng |
| Anisotropic Filter | Max | Max |

---

### 6.2 WebXR Setup

```javascript
import { VRButton } from 'three/addons/webxr/VRButton.js';

renderer.xr.enabled = true;
document.body.appendChild(VRButton.createButton(renderer));

renderer.xr.addEventListener('sessionstart', onVRStart);
renderer.xr.addEventListener('sessionend',   onVREnd);

function onVRStart() {
  earthMesh.geometry = buildGeometry(512); // LOD thấp hơn
  shadowMap.mapSize.set(2048, 2048);
}
```

---

### 6.3 Deploy — Netlify

- **Platform deploy:** Netlify (khuyến nghị) — kéo thả thư mục project lên là xong, không cần cấu hình
- **Thay thế:** Vercel hoặc GitHub Pages — đều hoạt động tương tự
- **HTTPS tự động** trên cả 3 platform — bắt buộc cho WebXR
- Build output: static HTML + JS bundle bằng **Vite**
- Các API (NASA, World Bank, CelesTrak...) đều hỗ trợ CORS sẵn — không cần cấu hình thêm

---

## PHẦN 7: DANH SÁCH NGUỒN DỮ LIỆU

> **Chiến lược tải dữ liệu có 3 loại:**
> - **Tải về local** (texture nặng, ảnh hưởng performance nếu load từ URL): bạn tự tải về, đặt vào thư mục `/textures/` trong project — AI agent sẽ viết code trỏ vào đúng đường dẫn
> - **Gọi API** (dữ liệu động): AI agent tự xử lý, gọi 1 lần + cache localStorage
> - **URL trực tiếp** (dữ liệu nhỏ, ít ảnh hưởng performance): AI agent tự load

---

| Thành phần | Nguồn dữ liệu | Cách tải |
|-----------|--------------|----------|
| **Texture màu Trái Đất** | NASA Visible Earth — Blue Marble | ⬇️ Tải về local |
| **Texture màu Mặt Trăng** | LROC WAC Mosaic (NASA) | ⬇️ Tải về local |
| **Displacement Map Trái Đất** | CGIAR-CSI SRTM 90m | ⬇️ Tải về local |
| **Displacement Map Mặt Trăng** | NASA LRO — LOLA | ⬇️ Tải về local |
| Texture Mặt Trời | NASA SDO — HMI Intensitygram | URL trực tiếp |
| Đèn đêm (Night Lights) | NASA Black Marble | URL trực tiếp |
| Mây thực tế | NASA GIBS API | Gọi API — cache 3h |
| Quỹ đạo (epoch) | NASA JPL Horizons System | Gọi API — cache 24h |
| Vệ tinh (TLE) | CelesTrak | Gọi API — cache 1h |
| GDP/Dân số | World Bank Open Data API | Gọi API — cache 7 ngày |
| Biên giới quốc gia | Natural Earth (Admin 0) | URL CDN công khai |
| Giao thông hàng không | OpenFlights | URL CDN công khai |
| Kỳ quan 3D | UNESCO World Heritage | URL CDN công khai |
| Eclipse data | NASA Eclipse Web Site | Gọi API — cache 24h |
| Vật lý & Geoid | NGA EGM2008 Geoid | Tích hợp sẵn trong code |

> ⚠️ **Lưu ý:** 4 dòng đầu đánh dấu ⬇️ là bạn cần tự tải về và đặt vào project trước khi deploy. AI agent sẽ dùng placeholder trong lúc dev và hướng dẫn bạn swap file thật vào sau.

---

## PHẦN 8: BỘ MÀU CHUẨN (ART REGISTRY)

### Texture & Color Space

| Thiên thể | Nguồn Texture | Color Space | Ghi chú |
|-----------|--------------|-------------|---------|
| Trái Đất | NASA Visible Earth | sRGB (Linear Workflow) | 12 texture theo tháng |
| Mặt Trăng | LROC WAC Mosaic | Grayscale Albedo (0.12) | Oren-Nayar shader |
| Mặt Trời | SDO HMI Intensitygram | HDR (High Dynamic Range) | Bước sóng 4500 Å |
| Vũ trụ (Background) | ESO Deep Space | True Black `#000000` | No Ambient Light |

### Bảng màu tham chiếu

| Vùng | HEX | Ghi chú |
|------|-----|---------|
| Đại dương sâu | `#000033` – `#000066` | Deep Navy — KHÔNG dùng Cyan |
| Moon base | `#4A4A4A` | Xám bê tông khô |
| Moon Maria | `#333333` | Xám than tối |
| Moon Highlands | `#808080` | Xám nhạt |
| Administrative & Social — nền | `#050A14` | Dark base map |
| Administrative & Social — border | `#00FFAA` | Emissive, opacity 0.6 |

---

## PHẦN 9: SETTINGS — UI/UX & TRẢI NGHIỆM VR

> Phần này định nghĩa toàn bộ giao diện người dùng, điều khiển VR, góc nhìn và các thiết lập có thể tuỳ chỉnh. Đây là phần AI code phải tuân theo để không tự bịa UI.

---

### 9.1 Vị trí Mặc định khi Khởi động (Default Spawn Position)

- **Vị trí:** Gần Trái Đất, tầm quỹ đạo ISS (~400 km trên bề mặt, scale theo scene)
- **Hướng nhìn:** Trái Đất chiếm khoảng 60–70% tầm nhìn — đủ thấy cả hành tinh nhưng vẫn cảm nhận được độ cong
- **Mặt Trăng** hiển thị ở phía xa, Mặt Trời ở vị trí tính theo giờ UTC thực

```javascript
// Spawn position mặc định
const ISS_ALTITUDE_SCALE = EARTH_RADIUS_SCENE * 1.063; // ~400km / 6371km
camera.position.set(0, ISS_ALTITUDE_SCALE * 0.3, ISS_ALTITUDE_SCALE);
camera.lookAt(earthMesh.position);
```

---

### 9.2 Điều khiển VR — Controller Layout

| Nút | Controller | Hành động |
|-----|-----------|-----------|
| **Y** (nút trên trái) | Tay trái | Toggle Mode: Natural ↔ Administrative & Social |
| **Trigger** (ngón trỏ phải) | Tay phải | Trỏ vào nút điều hướng trên màn hình → bấm để di chuyển |
| **Trigger** (ngón trỏ phải) | Tay phải | Trỏ vào quốc gia → bấm để chọn / xem thông tin |
| **Thumbstick phải** (bấm xuống) | Tay phải | Reset về vị trí spawn mặc định (tầm ISS) |

> **Lý do chọn nút Y cho toggle mode:** Nút Y nằm ở vị trí tự nhiên cho ngón cái tay trái, ít bị bấm nhầm hơn trigger.

#### Toggle Mode — Chi tiết

- Bấm nút **Y** một lần → chuyển sang mode kia, bề mặt fade 1.5 giây
- Một indicator nhỏ **luôn hiển thị** góc trên tầm nhìn cho biết đang ở mode nào:
  - `🌍 NATURAL` — chữ trắng mờ
  - `🗺️ ADMIN & SOCIAL` — chữ xanh `#00FFAA` mờ

---

### 9.3 Di chuyển — Nút Điều hướng trên Màn hình

- **Cơ chế:** Các nút điều hướng **luôn hiển thị** cố định ở góc dưới màn hình
- Hoạt động trên cả **Desktop** (click chuột) lẫn **VR** (trỏ controller vào nút → bấm trigger)

#### Layout nút điều hướng

```
         [ ▲ ]
    [ ◄ ] [ OK ] [ ► ]
         [ ▼ ]

    [ + ]   [ - ]        [ ⌂ ]
   zoom in zoom out     reset
```

| Nút | Hành động |
|-----|-----------|
| **▲ ▼ ◄ ►** | Di chuyển camera tiến/lùi/trái/phải trong không gian |
| **OK** | Xác nhận / dừng di chuyển |
| **+** | Zoom in — lại gần Trái Đất |
| **-** | Zoom out — ra xa, nhìn cả hệ Mặt Trời |
| **⌂** | Reset về vị trí mặc định (tầm quỹ đạo ISS) |

- Bấm giữ nút mũi tên → di chuyển liên tục, tốc độ tăng dần
- Bấm nhả → di chuyển một bước nhỏ
- **Giới hạn zoom:**
  - Gần nhất: bề mặt Trái Đất (không cho chui vào trong)
  - Xa nhất: đủ thấy cả hệ Mặt Trời trong 1 khung hình

```javascript
// On-screen navigation buttons
const NAV_SPEED_BASE = 0.5;   // đơn vị scene/giây
const NAV_SPEED_MAX  = 5.0;   // tốc độ tối đa khi giữ lâu

let navHoldTime = 0;

function onNavButtonHold(direction, delta) {
  navHoldTime += delta;
  const speed = Math.min(NAV_SPEED_BASE + navHoldTime * 2, NAV_SPEED_MAX);

  const moveVec = new THREE.Vector3();
  if (direction === 'forward')  moveVec.z -= speed * delta;
  if (direction === 'backward') moveVec.z += speed * delta;
  if (direction === 'left')     moveVec.x -= speed * delta;
  if (direction === 'right')    moveVec.x += speed * delta;
  if (direction === 'zoomin')   moveVec.z -= speed * delta * 2;
  if (direction === 'zoomout')  moveVec.z += speed * delta * 2;

  moveVec.applyQuaternion(camera.quaternion);
  camera.position.add(moveVec);
  clampCameraDistance(); // giữ trong giới hạn gần/xa
}

function onNavButtonRelease() {
  navHoldTime = 0;
}
```

---

### 9.4 Điều khiển Desktop (Non-VR)

Khi truy cập bằng browser thường (không có headset):

| Input | Hành động |
|-------|-----------|
| **Nút ▲ ▼ ◄ ► trên màn hình** | Di chuyển camera |
| **Nút + / - trên màn hình** | Zoom vào/ra |
| **Nút ⌂ trên màn hình** | Reset về vị trí mặc định |
| **Click trái + kéo** | Xoay góc nhìn quanh Trái Đất |
| **Scroll chuột** | Zoom nhanh vào/ra (phím tắt thay nút +/-) |
| **Phím M** | Toggle Mode: Natural ↔ Administrative & Social |
| **Click vào quốc gia** | Highlight + hiện thông tin (Administrative & Social mode) |

---

### 9.5 Cài đặt Hiển thị (Display Settings)

Người dùng có thể điều chỉnh các setting sau qua menu (Desktop: góc trên phải — VR: wrist panel phụ):

| Setting | Mặc định | Tuỳ chọn | Ghi chú |
|---------|----------|----------|---------|
| Tốc độ thời gian | 1x (thực tế) | 0x, 1x, 60x, 3600x | 3600x = 1 giây = 1 giờ thực |
| Hiển thị mây | Bật | Bật / Tắt | |
| Hiển thị đèn đêm | Bật | Bật / Tắt | |
| Hiển thị vệ tinh | Bật | Bật / Tắt | Chỉ có ở Administrative & Social |
| Hiển thị đường bay | Bật | Bật / Tắt | Chỉ có ở Administrative & Social |
| Chất lượng đồ hoạ | Auto | Low / Medium / High / Auto | Auto tự detect VR hay Desktop |
| Field of View (FOV) | 75° | 60° – 110° | Chỉ Desktop |

---

### 9.6 Target Performance

| Platform | Target FPS | Ghi chú |
|----------|-----------|---------|
| Desktop (Chrome) | 60 fps | Tối thiểu chấp nhận được |
| Meta Quest 2 | 72 fps | Bắt buộc — dưới ngưỡng này gây say VR |
| Meta Quest 3 | 90 fps | Mục tiêu lý tưởng |

Nếu FPS xuống dưới ngưỡng → tự động giảm chất lượng theo thứ tự ưu tiên:
1. Giảm Shadow Map resolution
2. Tắt Bloom/Lens Flare
3. Giảm Displacement Map resolution
4. Giảm số lượng vệ tinh hiển thị

