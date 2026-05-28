# VoxelCraft - Minecraft Clone

**VoxelCraft** là một game sandbox 3D phong cách Minecraft được xây dựng bằng  **JavaScript** ,  **HTML** , **CSS** và thư viện  **Three.js** . Dự án được thực hiện cho môn  **Computer Graphics - CS105** , tập trung vào việc mô phỏng thế giới voxel, xử lý camera góc nhìn thứ nhất, ánh sáng, vật liệu, texture, tương tác khối, entity, hiệu ứng particle và các kỹ thuật đồ họa thời gian thực.

## 1. Giới thiệu

VoxelCraft cho phép người chơi khám phá một thế giới voxel 3D, phá khối, đặt khối, tương tác với môi trường, quan sát chu kỳ ngày đêm, ánh sáng, bóng đổ và các hiệu ứng đồ họa khác. Game có nhiều chế độ chơi khác nhau nhằm vừa tạo trải nghiệm sandbox, vừa hỗ trợ trình diễn các kỹ thuật đồ họa trong đồ án.

Dự án không sử dụng game engine có sẵn như Unity hay Unreal Engine. Thay vào đó, phần render và logic game được xây dựng trực tiếp bằng Three.js, giúp thể hiện rõ các thành phần đồ họa máy tính như mesh generation, material, texture atlas, raycasting, lighting, shadow và particle system.

## 2. Công nghệ sử dụng

* **HTML5** : xây dựng cấu trúc trang và giao diện chính.
* **CSS3** : thiết kế giao diện menu, HUD, hotbar, hiệu ứng overlay.
* **JavaScript** : xử lý logic game, điều khiển người chơi, thế giới, vật phẩm, entity và tương tác.
* **Three.js** : render đồ họa 3D, camera, ánh sáng, mesh, material và shadow.
* **Simplex Noise** : sinh địa hình procedural.
* **Canvas Texture** : tạo texture atlas dạng pixel art bằng canvas.

## 3. Cấu trúc thư mục

```text
MINECRAFT/
├── js/
│   ├── blocks.js       # Khai báo block, item và dữ liệu vật liệu
│   ├── entities.js     # Xử lý entity như bò, zombie, drop item
│   ├── main.js         # Khởi tạo game, mode, input, render loop, showcase
│   ├── noise.js        # Noise dùng cho procedural terrain
│   ├── player.js       # Điều khiển người chơi, vật lý, va chạm, bơi
│   ├── texture.js      # Tạo texture atlas và material
│   ├── ui.js           # HUD, hotbar, máu, debug, thông báo
│   └── world.js        # Sinh chunk, mesh voxel, raycast, water rendering
├── index.html          # Trang chạy game chính
├── minecraft-clone.html
├── README.md
└── style.css
```

## 4. Cách chạy dự án

Do game chạy trực tiếp trên trình duyệt, có thể mở bằng Live Server trong VS Code.

### Cách chạy bằng VS Code

1. Mở thư mục project trong Visual Studio Code.
2. Cài extension **Live Server** nếu chưa có.
3. Click phải vào `index.html`.
4. Chọn  **Open with Live Server** .
5. Trình duyệt sẽ mở game tại địa chỉ dạng:

```text
http://127.0.0.1:5500/index.html
```

## 5. Các chế độ chơi

Game hiện có 3 chế độ chính:

### 5.1. Survival Mode

Chế độ sinh tồn cơ bản. Người chơi có máu, có thể bị zombie tấn công và cần tương tác với môi trường để sống sót.

Các chức năng chính:

* Người chơi có thanh máu.
* Zombie xuất hiện vào ban đêm.
* Có thể đánh zombie bằng kiếm.
* Có bộ đếm số zombie đã hạ.
* Có wave/sóng zombie.
* Có thể phá block để thu thập vật phẩm.
* Có thể ăn thịt để hồi máu.
* Có chu kỳ ngày đêm ảnh hưởng đến môi trường.

### 5.2. Creative Mode

Chế độ sáng tạo, cho phép người chơi tự do xây dựng và thử nghiệm block.

Các chức năng chính:

* Block gần như vô hạn.
* Có hotbar chứa nhiều loại block.
* Người chơi có thể tự do đặt và phá block.
* Có thể dùng xô nước để đặt nước.
* Nước do người chơi đặt được render dạng block/cube để dễ nhận biết.
* God mode được bật để hỗ trợ xây dựng.

### 5.3. Graphics Showcase Mode

Chế độ trình diễn đồ họa, được thiết kế riêng cho đồ án Computer Graphics. Map showcase có nhiều khu vực demo khác nhau để thể hiện các kỹ thuật đã cài đặt.

Các khu vực chính:

* **Block Gallery** : trình diễn texture atlas và các loại vật liệu voxel.
* **Transparency Demo** : trình diễn kính, lá cây, nước và vật liệu trong suốt.
* **Water Pool** : trình diễn nước tự nhiên, hồ kính và hiệu ứng bơi.
* **Raycast Wall** : trình diễn chọn block, phá block và đặt block bằng raycasting.
* **Particle Zone** : trình diễn particle khi phá block hoặc kích hoạt hiệu ứng.
* **Entity Pen** : trình diễn entity như bò, animation và shadow.
* **Point Light Demo** : trình diễn torch, point light, flicker và local lighting.

## 6. Điều khiển

| Phím / Chuột  | Chức năng                                           |
| --------------- | ----------------------------------------------------- |
| `W A S D`     | Di chuyển                                            |
| `Mouse`       | Nhìn xung quanh                                      |
| `Space`       | Nhảy / bơi lên                                     |
| `Shift`       | Chạy nhanh                                           |
| `Click trái` | Phá block / đánh                                   |
| `Click phải` | Đặt block / ăn thức ăn                           |
| `1 - 9`       | Chọn item trong hotbar                               |
| `Scroll`      | Đổi item trong hotbar                               |
| `E`           | Mở inventory                                         |
| `F3`          | Bật/tắt debug                                       |
| `T`           | Tua nhanh ngày/đêm                                 |
| `G`           | Bật/tắt God Mode                                    |
| `H`           | Ẩn/hiện bảng hướng dẫn và nhãn trong Showcase |
| `P`           | Kích hoạt particle demo trong Showcase              |
| `R`           | Reset vị trí trong Showcase                         |
| `ESC`         | Pause / Resume game                                   |

## 7. Các chức năng đã hoàn thành

### 7.1. Thế giới voxel

Game sử dụng hệ thống voxel tương tự Minecraft. Mỗi block là một ô lập phương trong không gian 3D. Thế giới được chia thành các chunk để dễ quản lý và render.

Các chức năng đã có:

* Sinh địa hình procedural bằng noise.
* Chia thế giới thành chunk.
* Tự động load chunk gần người chơi.
* Unload chunk ở xa để giảm tải.
* Tạo mesh cho chunk dựa trên các mặt block nhìn thấy.
* Không render các mặt bị che khuất giữa hai block đặc.
* Hỗ trợ nhiều loại block khác nhau như cỏ, đất, đá, cát, gỗ, lá, kính, gạch, tuyết, bedrock, nước.

### 7.2. Texture atlas

Texture của block được tạo bằng canvas và gom vào một texture atlas. Mỗi block sử dụng một vùng khác nhau trong atlas.

Các điểm nổi bật:

* Texture dạng pixel art.
* Grass top, grass side và dirt có texture riêng.
* Wood side và wood top khác nhau.
* Glass có texture viền và hiệu ứng sáng.
* Water có texture xanh dạng sóng.
* Brick, stone, cobblestone, sand, snow, leaves đều có texture riêng.
* Mapping UV cho các mặt block đã được chỉnh để tránh lỗi texture bị xoay sai.

### 7.3. Camera góc nhìn thứ nhất

Game sử dụng camera first-person giống Minecraft.

Các chức năng:

* Pointer lock khi vào game.
* Điều khiển camera bằng chuột.
* Giới hạn góc nhìn lên/xuống.
* Camera gắn với vị trí người chơi.
* Có crosshair ở giữa màn hình.

### 7.4. Điều khiển người chơi và vật lý

Người chơi có hệ thống vật lý cơ bản.

Các chức năng:

* Di chuyển bằng `W A S D`.
* Nhảy bằng `Space`.
* Chạy nhanh bằng `Shift`.
* Trọng lực.
* Va chạm với block.
* Kiểm tra đứng trên mặt đất.
* Rơi xuống và đứng trên terrain.
* Bơi trong nước.
* Water overlay khi ở trong nước.

### 7.5. Raycasting chọn block

Game sử dụng raycasting để xác định block mà người chơi đang nhìn vào.

Các chức năng:

* Highlight block đang được nhìn.
* Hiển thị tên block và tọa độ block.
* Click trái để phá block.
* Click phải để đặt block.
* Không cho đặt block đè lên vùng cơ thể người chơi.
* Có thể đặt block vào vị trí hợp lệ cạnh block đang nhìn.

### 7.6. Hệ thống block và item

Game có nhiều loại block và item khác nhau.

Một số block chính:

* Grass
* Dirt
* Stone
* Sand
* Wood
* Leaves
* Glass
* Brick
* Water
* Cobblestone
* Planks
* Snow
* Bedrock

Một số item:

* Sword
* Food / Meat
* Water bucket

Đặc biệt, nước được chia thành hai kiểu render:

* **Natural Water** : dùng cho biển, hồ tự nhiên và Water Pool trong Showcase. Nước render dạng mặt hồ phẳng, nhìn tự nhiên hơn.
* **Placed Water** : nước do người chơi đặt trong Creative/Survival. Nước render dạng block/cube để dễ nhận biết là block vừa đặt.

### 7.7. Hotbar và UI

Game có hệ thống HUD và hotbar giống game sandbox.

Các thành phần UI:

* Thanh máu.
* Hotbar 9 ô.
* Tên item/block đang chọn.
* Crosshair.
* Debug panel.
* Kill counter.
* Mode badge.
* Pickup toast.
* Heal toast.
* Death screen.
* Water overlay.
* Showcase hint panel.

Icon nước trong hotbar được đổi thành dạng  **xô nước** , phù hợp hơn với cách Minecraft sử dụng water bucket.

### 7.8. Survival system

Trong Survival Mode, game có một số yếu tố sinh tồn:

* Máu người chơi.
* Zombie tấn công người chơi.
* Zombie xuất hiện theo wave.
* Số zombie đã hạ.
* Thịt dùng để hồi máu.
* Người chơi có thể chết và respawn.

### 7.9. Entity system

Game có entity cơ bản, bao gồm:

* Cow
* Zombie
* Drop item

Các chức năng entity:

* Entity có mesh riêng.
* Cow có animation đơn giản.
* Zombie có AI di chuyển về phía người chơi.
* Có thể đánh zombie.
* Có thể giết bò để nhận thịt.
* Drop item có thể rơi và được nhặt.

### 7.10. Particle system

Game có hiệu ứng particle để tăng tính trực quan.

Các hiệu ứng:

* Particle khi phá block.
* Particle explosion trong Showcase.
* Particle dùng để minh họa khu vực Particle Demo.
* Particle có màu và chuyển động đơn giản.

### 7.11. Day/Night cycle

Game có chu kỳ ngày đêm.

Các chức năng:

* Mặt trời thay đổi vị trí theo thời gian.
* Màu nền trời thay đổi theo ngày/đêm.
* Ambient light thay đổi theo thời điểm.
* Directional light thay đổi theo vị trí mặt trời.
* Có thể dùng phím `T` để tua nhanh ngày/đêm.
* Zombie xuất hiện mạnh hơn vào ban đêm trong Survival Mode.

### 7.12. Lighting và Shadow

Game có nhiều loại ánh sáng và bóng đổ.

Các thành phần:

* Ambient Light.
* Hemisphere Light.
* Directional Light đóng vai trò mặt trời.
* Point Light cho torch trong Showcase.
* Shadow map cho mặt trời.
* Fake shadow cho player.
* Shadow cho object/entity.
* Torch có flicker nhẹ để tạo cảm giác ánh lửa.

Các điểm đã xử lý:

* Mesh mới được gán shadow flag ngay khi tạo để tránh bị flash sáng khi phá/đặt block.
* Water không cast shadow và không receive shadow để tránh lỗi nhìn xấu.
* Transparent block như glass được xử lý riêng.
* Leaves đã được chỉnh để không render như transparent block.

### 7.13. Graphics Showcase

Graphics Showcase là phần quan trọng nhất để trình bày đồ án. Chế độ này được thiết kế như một map demo có nhiều khu vực riêng.

Các khu vực gồm:

#### Block Gallery

Trình diễn nhiều loại block và texture khác nhau. Khu vực này giúp thể hiện texture atlas, vật liệu voxel và cách mapping texture lên block.

#### Transparency Demo

Trình diễn kính, lá cây, nước và các vật liệu có đặc tính khác nhau.

#### Water Pool

Trình diễn hồ nước với tường kính, mặt nước tự nhiên và khả năng bơi. Nước trong hồ được render theo dạng natural water để nhìn giống hồ/biển hơn, không phải block cube.

#### Raycast Wall

Trình diễn chức năng raycasting, chọn block, phá block và đặt block.

#### Particle Zone

Trình diễn hiệu ứng particle khi phá block hoặc khi nhấn phím `P`.

#### Entity Pen

Trình diễn entity như bò, animation và shadow.

#### Point Light Demo

Trình diễn torch, point light, flicker và local lighting.

## 8. Một số kỹ thuật đồ họa được áp dụng

Dự án có sử dụng nhiều kỹ thuật đồ họa máy tính cơ bản và trung cấp:

* Voxel rendering.
* Chunk-based world generation.
* Procedural terrain generation.
* Texture atlas.
* UV mapping.
* Face culling cho voxel mesh.
* First-person camera.
* Raycasting.
* Transparency rendering.
* Water rendering.
* Directional lighting.
* Ambient lighting.
* Hemisphere lighting.
* Point lighting.
* Shadow mapping.
* Particle system.
* Sprite label trong thế giới 3D.
* HUD overlay.
* Material separation: opaque, transparent và water material.

## 9. Những điểm nổi bật của đồ án

* Không chỉ là scene tĩnh mà là game có thể tương tác.
* Có nhiều mode khác nhau: Survival, Creative và Graphics Showcase.
* Có thế giới procedural thay vì map cố định hoàn toàn.
* Có hệ thống chunk giúp thế giới có thể mở rộng.
* Có raycasting để tương tác trực tiếp với voxel world.
* Có texture atlas procedural.
* Có water rendering tách riêng giữa natural water và placed water.
* Có day/night cycle.
* Có shadow và point light.
* Có particle effect.
* Có entity và animation cơ bản.
* Có UI/HUD hoàn chỉnh hơn so với một demo đồ họa đơn giản.

## 10. Hạn chế hiện tại

Dự án vẫn còn một số hạn chế:

* Hệ thống physics còn đơn giản.
* AI zombie chưa quá phức tạp.
* Water chưa có mô phỏng dòng chảy thật.
* Chưa có hệ thống lưu/load world.
* Chưa có crafting.
* Chưa có âm thanh môi trường hoàn chỉnh.
* Chưa tối ưu sâu cho thế giới cực lớn.
* Shadow và transparent material vẫn có thể có artifact trong một số góc nhìn.
* Inventory còn đơn giản.
* Entity animation vẫn ở mức cơ bản.

## 11. Hướng phát triển tiếp theo

Một số hướng có thể phát triển thêm:

* Thêm hệ thống lưu/load map.
* Thêm crafting table và công thức chế tạo.
* Thêm nhiều loại mob.
* Cải thiện AI zombie.
* Thêm biome khác nhau.
* Thêm cave generation tốt hơn.
* Thêm hiệu ứng thời tiết như mưa, sương mù, sấm sét.
* Thêm âm thanh bước chân, phá block, đặt block, nước, zombie.
* Tối ưu greedy meshing để giảm số lượng polygon.
* Thêm inventory dạng grid đầy đủ.
* Thêm minimap.
* Thêm post-processing như bloom hoặc color grading.
* Thêm shader nước để mặt nước có animation đẹp hơn.
* Thêm menu setting để chỉnh render distance, shadow, sensitivity.

## 12. Kết luận

VoxelCraft là một đồ án mô phỏng game sandbox voxel 3D bằng Three.js. Dự án thể hiện nhiều kiến thức quan trọng của môn Computer Graphics như mô hình hóa hình học, camera, ánh sáng, bóng đổ, texture mapping, raycasting, particle system và render vật liệu trong suốt.

Bên cạnh việc có thể chơi như một game đơn giản, dự án còn có chế độ Graphics Showcase để trình diễn rõ ràng các kỹ thuật đồ họa đã cài đặt. Đây là điểm giúp đồ án không chỉ dừng ở mức clone Minecraft cơ bản mà còn có giá trị trình bày và bảo vệ trong môn học.

## 13. Ghi chú

Dự án được xây dựng nhằm mục đích học tập và trình bày kỹ thuật đồ họa máy tính. Các ý tưởng gameplay lấy cảm hứng từ Minecraft, nhưng toàn bộ phần cài đặt trong đồ án được xây dựng lại bằng JavaScript và Three.js.
