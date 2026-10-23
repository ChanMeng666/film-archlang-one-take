"""Laneway House (archlang/examples/laneway-house.arch) as a 3D asset set -> glb.
Run:  blender -b --factory-startup --python-exit-code 1 -P build_house.py -- /path/to/out_dir
Plan coords (mm, SVG/y-down)  ->  Blender metres:  X = x/1000, Y = -y/1000, Z up.
glTF export converts to Y-up:   three.js (x, y_up, z) = (X, Z, -Y) = (x/1000, z, y_svg/1000).
Every piece is its own object (name = what it is) so three.js can grow them one by one on the beat.
Geometry comes from the plan (walls, openings, furniture footprints measured from the compiled SVG);
heights are authored here (archlang plans are a horizontal cut and draw no heights)."""
import bpy, bmesh, sys, os, math
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/house_out'
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
M = 1 / 1000.0
WALL_H = 2.7

def lin(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)

MATS = {}
def mat(name, hexcol, rough=0.6, metal=0.0, alpha=1.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lin(hexcol)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Alpha'].default_value = alpha
    MATS[name] = m; return m

for n, c, r, a in [
    ('m_wall', '#f4f1ea', .85, 1), ('m_slab', '#d9d4c8', .9, 1), ('m_floor_live', '#cdb892', .55, 1),
    ('m_floor_bath', '#c9ced3', .35, 1), ('m_floor_bed', '#d8c7ab', .6, 1), ('m_glass', '#9fc4e6', .05, .28),
    ('m_frame', '#2b2f38', .4, 1), ('m_wood', '#b98b5a', .5, 1), ('m_white', '#f6f6f4', .5, 1),
    ('m_steel', '#b9bdc4', .3, 1), ('m_plum', '#8052ff', .55, 1), ('m_rug', '#a9b4c2', .95, 1),
    ('m_linen', '#efece6', .9, 1), ('m_dark', '#3a3d45', .5, 1), ('m_roof', '#e4ddd0', .8, 1), ('m_fascia', '#2b2f38', .6, 1),
    ('m_porcelain', '#fbfbfb', .2, 1)]:
    mat(n, c, r, 0, a)
MATS['m_steel'].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = .8

def new_obj(name, bm, material, loc=(0, 0, 0), bevel=0.0):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    ob.location = loc
    if isinstance(material, str): material = [material]
    for mn in material: me.materials.append(MATS[mn])
    if bevel > 0:
        md = ob.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 2; md.limit_method = 'ANGLE'
    return ob

def add_box(bm, x0, y0, z0, x1, y1, z1, mi=0):
    """box between two corner points in plan mm (y-down) + z in metres."""
    X0, X1 = x0 * M, x1 * M; Y0, Y1 = -y1 * M, -y0 * M
    v = [bm.verts.new(p) for p in [(X0,Y0,z0),(X1,Y0,z0),(X1,Y1,z0),(X0,Y1,z0),(X0,Y0,z1),(X1,Y0,z1),(X1,Y1,z1),(X0,Y1,z1)]]
    for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
        face = bm.faces.new([v[i] for i in f]); face.material_index = mi
    return v

def wall(name, axis, c0, c1, fixed, thick, openings):
    """axis 'x': runs along x from c0..c1 at y=fixed (thickness centred); openings = (a,b,sill,head) along the run, mm / metres."""
    bm = bmesh.new(); h = thick / 2
    cuts = sorted(openings, key=lambda o: o[0]); pos = c0
    def seg(a, b, z0, z1):
        if b - a <= 0 or z1 - z0 <= 0: return
        if axis == 'x': add_box(bm, a, fixed - h, z0, b, fixed + h, z1)
        else: add_box(bm, fixed - h, a, z0, fixed + h, b, z1)
    for a, b, sill, head in cuts:
        seg(pos, a, 0, WALL_H)
        if sill > 0: seg(a, b, 0, sill)
        seg(a, b, head, WALL_H)
        pos = b
    seg(pos, c1, 0, WALL_H)
    return new_obj(name, bm, 'm_wall', bevel=0.004)

# ---- floor ------------------------------------------------------------------------------------
bm = bmesh.new(); add_box(bm, -100, -100, -0.22, 7600, 6600, 0.0); new_obj('floor_slab', bm, 'm_slab', bevel=0.006)
for nm, (x0, y0, x1, y1), mn in [('floor_live', (100, 100, 4150, 6400), 'm_floor_live'), ('floor_bath', (4250, 100, 7400, 2450), 'm_floor_bath'),
                                  ('floor_bed', (4250, 2550, 7400, 6400), 'm_floor_bed')]:
    bm = bmesh.new(); add_box(bm, x0, y0, 0.0, x1, y1, 0.012); new_obj(nm, bm, mn)

# ---- walls (openings from the .arch, mm along the run) --------------------------------------------
DOOR_H = 2.1
wall('wall_lane',   'x', -100, 7600, 0,    200, [(1650, 2550, 0, DOOR_H)])
wall('wall_garden', 'x', -100, 7600, 6500, 200, [(200, 1200, 0.9, DOOR_H), (1800, 3600, 0, DOOR_H), (5050, 6650, 0.9, DOOR_H)])
wall('wall_west',   'y', 100, 6400, 0,     200, [(1800, 3000, 0.9, DOOR_H)])
wall('wall_east',   'y', 100, 6400, 7500,  200, [(1200, 1800, 1.2, DOOR_H)])
wall('wall_hall',   'y', 100, 6400, 4200,  100, [(500, 1300, 0, DOOR_H), (5200, 6000, 0, DOOR_H)])
wall('wall_bath',   'x', 4250, 7400, 2500, 100, [])

# ---- windows: frame + glass (2 material slots) -----------------------------------------------------
def window(name, axis, a, b, fixed, sill, head, thick):
    bm = bmesh.new(); f = 40; t = 60
    def box(x0, y0, x1, y1, z0, z1, mi):
        if axis == 'x': add_box(bm, x0, fixed - y0, z0, x1, fixed + y1, z1, mi)
        else: add_box(bm, fixed - y0, x0, z0, fixed + y1, x1, z1, mi)
    box(a, t/2, b, t/2, sill, sill + f * M, 0); box(a, t/2, b, t/2, head - f * M, head, 0)
    box(a, t/2, a + f, t/2, sill, head, 0); box(b - f, t/2, b, t/2, sill, head, 0)
    box((a+b)/2 - 20, t/2, (a+b)/2 + 20, t/2, sill, head, 0)
    box(a + f, 8, b - f, 8, sill + f * M, head - f * M, 1)
    return new_obj(name, bm, ['m_frame', 'm_glass'])
window('win_west',   'y', 1800, 3000, 0,    0.9, DOOR_H, 200)
window('win_garden1','x', 200, 1200, 6500,  0.9, DOOR_H, 200)
window('win_garden2','x', 5050, 6650, 6500, 0.9, DOOR_H, 200)
window('win_east',   'y', 1200, 1800, 7500, 1.2, DOOR_H, 200)

# sliding garden door: two glass panels in frames (panel B slides)
for nm, (x0, x1, off) in [('slide_fixed', (1800, 2700, 40)), ('slide_moving', (2700, 3600, -40))]:
    bm = bmesh.new(); f = 40
    for (a, b, z0, z1, mi) in [(x0, x1, 0, f*M, 0), (x0, x1, DOOR_H - f*M, DOOR_H, 0), (x0, x0 + f, 0, DOOR_H, 0), (x1 - f, x1, 0, DOOR_H, 0)]:
        add_box(bm, a, 6500 - 30 + off, z0, b, 6500 + 30 + off, z1, mi)
    add_box(bm, x0 + f, 6500 - 8 + off, f * M, x1 - f, 6500 + 8 + off, DOOR_H - f * M, 1)
    new_obj(nm, bm, ['m_frame', 'm_glass'])

# ---- door leaves, origin at the hinge ------------------------------------------------------------------
def leaf(name, hinge, axis, length, thick=40, mat_='m_wood'):
    """closed pose: lies along `axis` ('x' or 'y' in plan) from the hinge. Origin = hinge."""
    bm = bmesh.new()
    if axis == 'x': add_box(bm, 0, -thick/2, 0, length, thick/2, DOOR_H - 0.03)
    else:           add_box(bm, -thick/2, 0, 0, thick/2, length, DOOR_H - 0.03)
    return new_obj(name, bm, mat_, loc=(hinge[0] * M, -hinge[1] * M, 0), bevel=0.004)
leaf('door_front', (1650, 0), 'x', 900)       # swings to +y (into the living room)
leaf('door_bed',   (4200, 5200), 'y', 800)    # swings to +x (into the bedroom)
leaf('door_bath',  (4200, 500), 'y', 800)     # pocket door: slides into the hall wall

# ---- furniture (footprints measured from the compiled plan svg; heights authored) ----------------------
def furn(name, parts, bevel=0.012):
    """parts: [(x0,y0,x1,y1,z0,z1,material_name)]"""
    names = []; bm = bmesh.new()
    for p in parts:
        if p[6] not in names: names.append(p[6])
        add_box(bm, p[0], p[1], p[4], p[2], p[3], p[5], names.index(p[6]))
    return new_obj(name, bm, names, bevel=bevel)

furn('furn_fridge', [(100,100,700,700,0.0,1.8,'m_steel')], 0.02)
furn('furn_stove', [(100,900,700,1500,0.0,0.9,'m_white'), (100,900,700,1500,0.9,0.93,'m_dark')])
furn('furn_sink', [(100,1600,700,2400,0.0,0.9,'m_white'), (160,1700,640,2300,0.9,0.92,'m_steel')])
furn('furn_counter', [(100,2500,700,3100,0.0,0.9,'m_white'), (100,2500,700,3100,0.9,0.93,'m_wood')])
furn('furn_rug', [(400,2700,3200,6100,0.012,0.03,'m_rug')], 0.004)
furn('furn_table', [(1450,2800,2750,3700,0.72,0.76,'m_wood'),
                    (1500,2850,1560,2910,0.0,0.72,'m_dark'), (2640,2850,2700,2910,0.0,0.72,'m_dark'),
                    (1500,3590,1560,3650,0.0,0.72,'m_dark'), (2640,3590,2700,3650,0.0,0.72,'m_dark')], 0.008)
furn('furn_sofa', [(350,4100,1250,6100,0.0,0.18,'m_dark'), (350,4100,1250,6100,0.18,0.42,'m_plum'),
                   (350,4100,600,6100,0.42,0.85,'m_plum'), (350,4100,1250,4350,0.42,0.62,'m_plum'), (350,5850,1250,6100,0.42,0.62,'m_plum')], 0.03)
furn('furn_bed', [(5600,4100,7100,6100,0.0,0.3,'m_wood'), (5650,4150,7050,6050,0.3,0.5,'m_linen'),
                  (5600,5980,7100,6100,0.3,0.95,'m_wood'), (5700,5500,6250,5950,0.5,0.6,'m_white'), (6450,5500,7000,5950,0.5,0.6,'m_white')], 0.02)
furn('furn_robe', [(4450,2650,6250,3250,0.0,2.1,'m_wood'), (5340,2650,5360,3250,0.0,2.1,'m_dark')], 0.01)
furn('furn_shower', [(6500,100,7400,1000,0.0,0.06,'m_porcelain')], 0.006)
furn('furn_wc', [(4250,1800,4650,2150,0.0,0.4,'m_porcelain'), (4250,2150,4650,2450,0.0,0.8,'m_porcelain')], 0.02)
furn('furn_basin', [(6800,2000,7400,2450,0.78,0.86,'m_porcelain'), (7000,2350,7200,2450,0.0,0.78,'m_porcelain')], 0.02)

# ---- roof (gable, ridge along x, 300 mm overhang) ----------------------------------------------------------------
bm = bmesh.new()
y0, y1 = -0.4, 6.9; ym = (y0 + y1) / 2; x0, x1 = -0.4, 7.9; rise = 1.15; z0 = WALL_H
prof = [(y0, z0 - 0.0), (y1, z0 - 0.0), (y1, z0 + 0.14), (ym, z0 + rise + 0.14), (y0, z0 + 0.14)]
def P(x, p): return (x, -p[0], p[1])
vs0 = [bm.verts.new(P(x0, p)) for p in prof]; vs1 = [bm.verts.new(P(x1, p)) for p in prof]
bm.faces.new(vs0[::-1]); bm.faces.new(vs1)
for i in range(5): bm.faces.new([vs0[i], vs0[(i+1) % 5], vs1[(i+1) % 5], vs1[i]])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
new_obj('roof', bm, 'm_roof', bevel=0.01)

# ---- export ------------------------------------------------------------------------------------------------------------
bpy.ops.object.select_all(action='SELECT')
glb = os.path.join(OUT, 'laneway_house.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_materials='EXPORT', export_cameras=False, export_lights=False)
print('exported', glb, os.path.getsize(glb), 'bytes;', len(bpy.data.objects), 'objects')

# ---- a Blender preview render (verifies the model; not used in the film) --------------------------------------------------
cam = bpy.data.cameras.new('cam'); cam.lens = 32
co = bpy.data.objects.new('cam', cam); scene.collection.objects.link(co); scene.camera = co
co.location = (13.5, -17, 10.5); co.rotation_euler = (math.radians(58), 0, math.radians(38)); 
tgt = Vector((3.75, -3.25, 1.0)); d = tgt - co.location; co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.5; so = bpy.data.objects.new('sun', sun); scene.collection.objects.link(so)
so.rotation_euler = (math.radians(50), 0, math.radians(-35))
w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.9, 0.88, 0.84, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
bpy.data.objects['roof'].hide_render = True
scene.render.engine = 'CYCLES'; scene.cycles.samples = 24; scene.cycles.use_denoising = True; scene.cycles.device = 'CPU'
scene.render.resolution_x = 1280; scene.render.resolution_y = 720; scene.render.filepath = os.path.join(OUT, 'preview_cutaway.png')
bpy.ops.render.render(write_still=True)
bpy.data.objects['roof'].hide_render = False
scene.render.filepath = os.path.join(OUT, 'preview_roof.png'); bpy.ops.render.render(write_still=True)
print('done')
