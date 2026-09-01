import re

with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target1 = """                                  {/* 5. Nome da Plataforma */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Nome da Plataforma</label>
                                    <input 
                                      type="text" 
                                      value={localSettings?.app_name || ''}
                                      onChange={(e) => setLocalSettings({ ...localSettings, app_name: e.target.value })}
                                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                    />
                                  </div>"""

replacement1 = """                                  {/* 5. Nome da Plataforma */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Nome da Plataforma</label>
                                    <input 
                                      type="text" 
                                      value={localSettings?.app_name || ''}
                                      onChange={(e) => setLocalSettings({ ...localSettings, app_name: e.target.value })}
                                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                    />
                                  </div>

                                  {/* 6. Cor da Letra do Nome da Plataforma */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Cor da Letra do Nome da Plataforma</label>
                                    <div className="flex flex-wrap items-center gap-3 p-3 bg-black/60 rounded-xl border border-white/10">
                                      <div className="flex items-center gap-2">
                                        <input 
                                          type="color" 
                                          value={draftCustomTexts['auth.title_color'] || settings.custom_texts?.['auth.title_color'] || '#ffffff'}
                                          onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'auth.title_color': e.target.value })}
                                          className="w-9 h-9 rounded-lg bg-transparent border border-white/20 cursor-pointer p-0.5"
                                        />
                                        <input 
                                          type="text" 
                                          value={draftCustomTexts['auth.title_color'] !== undefined ? draftCustomTexts['auth.title_color'] : (settings.custom_texts?.['auth.title_color'] || '#ffffff')}
                                          onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'auth.title_color': e.target.value })}
                                          placeholder="#ffffff"
                                          className="w-24 bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase font-mono focus:border-blue-500 outline-none"
                                        />
                                      </div>

                                      <div className="flex flex-wrap gap-1.5 items-center ml-auto">
                                        {[
                                          { name: 'Branco', color: '#ffffff' },
                                          { name: 'Dourado', color: '#f59e0b' },
                                          { name: 'Rosa / Rose', color: '#f43f5e' },
                                          { name: 'Primária', color: localSettings?.primary_color || settings.primary_color || '#ef4444' },
                                          { name: 'Esmeralda', color: '#10b981' },
                                          { name: 'Azul Céu', color: '#38bdf8' },
                                          { name: 'Púrpura', color: '#a855f7' },
                                        ].map((preset) => {
                                          const currentColor = (draftCustomTexts['auth.title_color'] || settings.custom_texts?.['auth.title_color'] || '#ffffff').toLowerCase();
                                          const isSelected = currentColor === preset.color.toLowerCase();
                                          return (
                                            <button
                                              key={preset.name + preset.color}
                                              type="button"
                                              title={preset.name}
                                              onClick={() => setDraftCustomTexts({ ...draftCustomTexts, 'auth.title_color': preset.color })}
                                              className={`w-6 h-6 rounded-md border transition-all cursor-pointer ${isSelected ? 'border-white scale-110 shadow-md ring-2 ring-white/30' : 'border-white/20 hover:scale-105 opacity-80 hover:opacity-100'}`}
                                              style={{ backgroundColor: preset.color }}
                                            />
                                          );
                                        })}
                                        <button
                                          type="button"
                                          onClick={() => setDraftCustomTexts({ ...draftCustomTexts, 'auth.title_color': '#ffffff' })}
                                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer"
                                          title="Redefinir para Branco Padrão"
                                        >
                                          Padrão
                                        </button>
                                      </div>
                                    </div>
                                  </div>"""

target2 = """                                           {(localSettings?.login_display_type === 'title' || localSettings?.login_display_type === 'both') && (
                                             <h2 className="text-lg font-black italic uppercase tracking-tighter" style={{ color: localSettings?.primary_color || settings.primary_color }}>
                                               {localSettings?.app_name || 'App Name'}
                                             </h2>
                                           )}"""

replacement2 = """                                           {(localSettings?.login_display_type === 'title' || localSettings?.login_display_type === 'both') && (
                                             <h2 
                                               className="text-lg font-black italic uppercase tracking-tighter transition-colors" 
                                               style={{ 
                                                 color: draftCustomTexts['auth.title_color'] || settings.custom_texts?.['auth.title_color'] || '#ffffff' 
                                               }}
                                             >
                                               {localSettings?.app_name || 'App Name'}
                                             </h2>
                                           )}"""

assert target1 in content, "target1 not found"
assert target2 in content, "target2 not found"

content = content.replace(target1, replacement1, 1)
content = content.replace(target2, replacement2, 1)

with open('src/components/AdminPanel.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Successfully replaced both targets in AdminPanel.tsx!")
