#!/usr/bin/env python3
"""Fix desktop battlefield overlap: clear divider + proper row heights."""

content = open('/home/user/workspace/gwunt/client/src/App.tsx').read()

# ─── 1. BattleRow: increase minHeight so rows never squeeze below card height ─
OLD_ROW = '        className={`battlefield-row ${rowType}-row ${isValidDrop ? \'valid-drop\' : \'\'}`}\n        style={{ flex: 1, background: isEnemy ? \'rgba(255,60,60,0.03)\' : \'rgba(60,60,255,0.03)\', minHeight: 96 }}'
NEW_ROW = '        className={`battlefield-row ${rowType}-row ${isValidDrop ? \'valid-drop\' : \'\'}`}\n        style={{ flex: 1, background: isEnemy ? \'rgba(255,60,60,0.03)\' : \'rgba(60,60,255,0.03)\', minHeight: 100, overflowX: \'auto\' }}'
assert OLD_ROW in content, "BattleRow minHeight not found"
content = content.replace(OLD_ROW, NEW_ROW, 1)

# ─── 2. Desktop battlefield wrapper: use flex: none + explicit heights ─────────
# The outer wrapper gives each side equal flex-1 slices, but we need a clear gap
OLD_BATTLEFIELD_OUTER = '      {/* Battlefield */}\n      <div style={{ flex: 1, display: \'flex\', flexDirection: \'column\', padding: \'4px 8px\', gap: 3, overflow: \'hidden\' }}>\n        <div style={{ flex: 1, display: \'flex\', flexDirection: \'column\', gap: 2, minHeight: 0 }}>\n          <BattleRow row={state.ai.battlefield.ritual} label="Ritual" rowType="ritual" isEnemy hasWeather={state.weatherEffects.ritual} isValidDrop={false} score={getRowScore(state.ai.battlefield.ritual)} onCardClick={setZoomedCard} />\n          <BattleRow row={state.ai.battlefield.ranged} label="Ranged" rowType="ranged" isEnemy hasWeather={state.weatherEffects.ranged} isValidDrop={false} score={getRowScore(state.ai.battlefield.ranged)} onCardClick={setZoomedCard} />\n          <BattleRow row={state.ai.battlefield.close} label="Close" rowType="close" isEnemy hasWeather={state.weatherEffects.close} isValidDrop={false} score={getRowScore(state.ai.battlefield.close)} onCardClick={setZoomedCard} />\n        </div>\n\n        <div style={{ height: 2, background: \'linear-gradient(90deg, transparent, #C8A04040, #C8A040, #C8A04040, transparent)\', flexShrink: 0, margin: \'2px 0\' }} />\n\n        <div style={{ flex: 1, display: \'flex\', flexDirection: \'column\', gap: 2, minHeight: 0 }}>\n          <BattleRow row={state.player.battlefield.close} label="Close" rowType="close" isEnemy={false} hasWeather={state.weatherEffects.close} isValidDrop={isValidRow(\'close\') || (drag.active && (drag.card?.def.type === \'weather\' || drag.card?.def.type === \'special\'))} score={getRowScore(state.player.battlefield.close)} onPointerEnter={() => setHoveredRow(\'close\')} onPointerLeave={() => setHoveredRow(null)} onCardClick={setZoomedCard} />\n          <BattleRow row={state.player.battlefield.ranged} label="Ranged" rowType="ranged" isEnemy={false} hasWeather={state.weatherEffects.ranged} isValidDrop={isValidRow(\'ranged\') || (drag.active && (drag.card?.def.type === \'weather\' || drag.card?.def.type === \'special\'))} score={getRowScore(state.player.battlefield.ranged)} onPointerEnter={() => setHoveredRow(\'ranged\')} onPointerLeave={() => setHoveredRow(null)} onCardClick={setZoomedCard} />\n          <BattleRow row={state.player.battlefield.ritual} label="Ritual" rowType="ritual" isEnemy={false} hasWeather={state.weatherEffects.ritual} isValidDrop={isValidRow(\'ritual\') || (drag.active && (drag.card?.def.type === \'weather\' || drag.card?.def.type === \'special\'))} score={getRowScore(state.player.battlefield.ritual)} onPointerEnter={() => setHoveredRow(\'ritual\')} onPointerLeave={() => setHoveredRow(null)} onCardClick={setZoomedCard} />\n        </div>\n      </div>'

NEW_BATTLEFIELD_OUTER = '''      {/* Battlefield */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '4px 8px', gap: 0, overflow: 'hidden', minHeight: 0 }}>
        {/* AI side */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0, paddingBottom: 4, overflowY: 'auto' }}>
          <BattleRow row={state.ai.battlefield.ritual} label="Ritual" rowType="ritual" isEnemy hasWeather={state.weatherEffects.ritual} isValidDrop={false} score={getRowScore(state.ai.battlefield.ritual)} onCardClick={setZoomedCard} />
          <BattleRow row={state.ai.battlefield.ranged} label="Ranged" rowType="ranged" isEnemy hasWeather={state.weatherEffects.ranged} isValidDrop={false} score={getRowScore(state.ai.battlefield.ranged)} onCardClick={setZoomedCard} />
          <BattleRow row={state.ai.battlefield.close} label="Close" rowType="close" isEnemy hasWeather={state.weatherEffects.close} isValidDrop={false} score={getRowScore(state.ai.battlefield.close)} onCardClick={setZoomedCard} />
        </div>

        {/* Center divider — clearly separates the two sides */}
        <div style={{ flexShrink: 0, padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, #C8A04030)' }} />
          <div style={{ height: 6, width: '60%', background: 'linear-gradient(90deg, transparent, #C8A04070, #C8A040CC, #C8A04070, transparent)', borderRadius: 3, boxShadow: '0 0 12px rgba(200,160,64,0.35), 0 0 4px rgba(200,160,64,0.6)' }} />
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, #C8A04030, transparent)' }} />
        </div>

        {/* Player side */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0, paddingTop: 4, overflowY: 'auto' }}>
          <BattleRow row={state.player.battlefield.close} label="Close" rowType="close" isEnemy={false} hasWeather={state.weatherEffects.close} isValidDrop={isValidRow('close') || (drag.active && (drag.card?.def.type === 'weather' || drag.card?.def.type === 'special'))} score={getRowScore(state.player.battlefield.close)} onPointerEnter={() => setHoveredRow('close')} onPointerLeave={() => setHoveredRow(null)} onCardClick={setZoomedCard} />
          <BattleRow row={state.player.battlefield.ranged} label="Ranged" rowType="ranged" isEnemy={false} hasWeather={state.weatherEffects.ranged} isValidDrop={isValidRow('ranged') || (drag.active && (drag.card?.def.type === 'weather' || drag.card?.def.type === 'special'))} score={getRowScore(state.player.battlefield.ranged)} onPointerEnter={() => setHoveredRow('ranged')} onPointerLeave={() => setHoveredRow(null)} onCardClick={setZoomedCard} />
          <BattleRow row={state.player.battlefield.ritual} label="Ritual" rowType="ritual" isEnemy={false} hasWeather={state.weatherEffects.ritual} isValidDrop={isValidRow('ritual') || (drag.active && (drag.card?.def.type === 'weather' || drag.card?.def.type === 'special'))} score={getRowScore(state.player.battlefield.ritual)} onPointerEnter={() => setHoveredRow('ritual')} onPointerLeave={() => setHoveredRow(null)} onCardClick={setZoomedCard} />
        </div>
      </div>'''

assert OLD_BATTLEFIELD_OUTER in content, "Battlefield outer not found"
content = content.replace(OLD_BATTLEFIELD_OUTER, NEW_BATTLEFIELD_OUTER, 1)

with open('/home/user/workspace/gwunt/client/src/App.tsx', 'w') as f:
    f.write(content)

print("✅ Battlefield layout patched")
print(f"  Lines: {len(content.splitlines())}")
