# Weather Planner — Skill

The get_weather_forecast tool returns a list with these exact keys (from weather.py):
date, temp_high_c, temp_low_c, condition, weather_icon, precipitation_probability (0–100 integer)

## Day classification by precipitation_probability
| Range  | Classification   | Scheduling action                                      |
|--------|------------------|--------------------------------------------------------|
| 0–20   | Outdoor day      | Prioritise beaches, viewpoints, walking tours          |
| 21–40  | Good day         | Normal mix of indoor and outdoor                       |
| 41–60  | Flexible day     | Outdoor morning, indoor backup for afternoon           |
| 61–80  | Indoor day       | Mostly indoor — brief outdoor only if needed           |
| 81–100 | Full indoor day  | Museums, galleries, covered markets, spa — no outdoor  |

## Temperature guidance
- Below 10°C: advise warm layers; outdoor activities will be cold
- 10–20°C: comfortable, no adjustment
- 20–28°C: ideal
- 28–35°C: outdoor only before 11:00 and after 17:00; avoid midday sun
- Above 35°C: strong advisory — outdoor only before 11:00 and after 17:00, hydration essential

## Tip quality rules
Tips must be specific and actionable.

Good:
- "Rain likely after 15:00 — do outdoor sightseeing in the morning"
- "35°C forecast — visit the Acropolis at 09:00 before the heat peaks"
- "Perfect beach conditions — ideal day for the boat trip"

Never:
- "The weather may be changeable"
- "Dress appropriately"
- "Check the forecast before going out"
