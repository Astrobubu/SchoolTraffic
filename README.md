# SafePod Traffic Simulation

Interactive traffic simulation demonstrating how the **SafePod system** can reduce school traffic congestion at GEMS Jumeirah Primary School (Al Safa 1, Dubai).

![SafePod Simulation](https://img.shields.io/badge/deck.gl-TripsLayer-blue) ![Mapbox](https://img.shields.io/badge/Mapbox-GL%20JS-green)

## The Problem

Every school morning, 400+ cars converge on 2 school gates, creating:
- **25+ minute wait times**
- **95% road congestion**
- **Gridlock** affecting the entire neighborhood

## The SafePod Solution

Distribute drop-offs across **5 SafePods** located 300m from school:
- **500 cars ÷ 5 pods = 100 cars per location**
- **3 minute average wait time**
- **25% congestion** (within normal capacity)
- **Shuttle buses** transport kids from pods to school

## Features

- **Real Road Data**: Uses Mapbox Directions API (respects one-way streets, turn restrictions)
- **Before/After Comparison**: Toggle to see the difference
- **Animated Vehicles**: 700+ vehicles with realistic arrival patterns (bell curve around 7:45 AM)
- **Live Statistics**: Active vehicles, queue length, wait times, congestion %
- **Time-based Rules**: Peak hours (7:30-8:15) = pods only, after = direct drop-off OK
- **Shuttle Visualization**: Yellow buses running Pod → School every 5 minutes

## Traffic Sources (Realistic)

- **70%** from highways (Sheikh Zayed Road, Al Wasl Road)
- **25%** from local roads around the block
- **5%** from residents inside the block

## Tech Stack

- **[deck.gl](https://deck.gl)** - TripsLayer for animated vehicle paths
- **[Mapbox GL JS](https://mapbox.com)** - Real satellite/street maps
- **Vite** - Fast development server

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Controls

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| B | Before mode |
| A | After (SafePod) mode |
| 1/5/0 | Speed 1x/5x/10x |

## Screenshot

The simulation shows:
- **Blue trails**: Cars arriving at school
- **Purple trails**: Cars departing
- **Green trails**: Cars going to pods
- **Yellow trails**: Shuttle buses
- **Red marker**: School
- **Green markers**: SafePods

## License

MIT
