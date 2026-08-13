//! Double Edit macro engine — hold one trigger to spam open→tile→settle→confirm.
//!
//! Premium latch rules (speed stays on the fast profile):
//!   • TILE select spans ≥ two 120Hz polls.
//!   • Select never joins on the same pump as edit enter (edit-alone gate).
//!   • After TILE, breathe keeps edit+select before settle.
//!   • Tile clock only runs while edit+select are actually on the wire.

use std::sync::Mutex;

const BUTTON_COUNT: usize = 24;
const BTN_DOWN: f32 = 0.35;
const TRIGGER_ON: f32 = 0.45;
const TRIGGER_OFF: f32 = 0.20;

const DE_POLL_US: u64 = 8334;
/// Fast edit entry — bursts keep it visible.
const DE_OPEN_US: u64 = 4000;
/// Tile latch floor — never thin this.
const DE_TILE_US: u64 = DE_POLL_US * 2 + 1000;
const DE_SETTLE_US: u64 = 700;
const DE_CONFIRM_MIN_US: u64 = 1;
/// Hold completed tile so the game polls select before settle.
const DE_TILE_BREATHE_US: u64 = 3500;
/// Edit-alone after open before select may join (prevents ghost misses).
const DE_SELECT_JOIN_US: u64 = 2500;

const DE_OPEN_MIN_REPORTS: u32 = 3;
const DE_TILE_MIN_REPORTS: u32 = 8;
const DE_SETTLE_MIN_REPORTS: u32 = 2;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Stage {
    Idle,
    Open,
    Tile,
    Settle,
    Confirm,
}

impl Stage {
    fn next(self) -> Self {
        match self {
            Stage::Open => Stage::Tile,
            Stage::Tile => Stage::Settle,
            Stage::Settle => Stage::Confirm,
            Stage::Confirm => Stage::Open,
            Stage::Idle => Stage::Open,
        }
    }

    fn held(self) -> bool {
        matches!(self, Stage::Open | Stage::Tile | Stage::Settle)
    }
}

struct Config {
    enabled: bool,
    trigger: i32,
    tap_delay_us: u64,
    edit: i32,
    select: i32,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            enabled: false,
            trigger: 6,
            tap_delay_us: 1,
            edit: 11,
            select: 7,
        }
    }
}

struct State {
    stage: Stage,
    trigger_latched: bool,
    stage_reports: u32,
    stage_armed_us: Option<u64>,
    due_us: u64,
    breathe_until_us: u64,
    /// Earliest time select may go down during Tile (edit-alone gate).
    select_join_us: u64,
    cycles: u64,
    needs_next_stage: bool,
}

impl Default for State {
    fn default() -> Self {
        Self {
            stage: Stage::Idle,
            trigger_latched: false,
            stage_reports: 0,
            stage_armed_us: None,
            due_us: 0,
            breathe_until_us: 0,
            select_join_us: 0,
            cycles: 0,
            needs_next_stage: false,
        }
    }
}

struct Engine {
    cfg: Config,
    st: State,
}

impl Engine {
    fn new() -> Self {
        Self {
            cfg: Config::default(),
            st: State::default(),
        }
    }

    fn reset_stage_clock(&mut self) {
        self.st.stage_reports = 0;
        self.st.stage_armed_us = None;
        self.st.due_us = 0;
    }

    fn go_idle(&mut self) {
        if self.st.stage != Stage::Idle {
            self.st.stage = Stage::Idle;
            self.reset_stage_clock();
            self.st.breathe_until_us = 0;
            self.st.select_join_us = 0;
            self.st.needs_next_stage = false;
        }
        self.st.trigger_latched = false;
    }

    fn stage_us(&self, stage: Stage) -> u64 {
        match stage {
            Stage::Open => DE_OPEN_US,
            Stage::Tile => DE_TILE_US,
            Stage::Settle => DE_SETTLE_US,
            Stage::Confirm => self.cfg.tap_delay_us.max(DE_CONFIRM_MIN_US),
            Stage::Idle => DE_SETTLE_US,
        }
    }

    fn min_reports(stage: Stage) -> u32 {
        match stage {
            Stage::Tile => DE_TILE_MIN_REPORTS,
            Stage::Open => DE_OPEN_MIN_REPORTS,
            Stage::Settle => DE_SETTLE_MIN_REPORTS,
            _ => 1,
        }
    }

    fn trigger_held(&mut self, buttons: &[f32]) -> bool {
        if !self.cfg.enabled || self.cfg.trigger < 0 {
            self.st.trigger_latched = false;
            return false;
        }
        let idx = self.cfg.trigger as usize;
        let raw = if idx < buttons.len() { buttons[idx] } else { 0.0 };
        if self.st.trigger_latched {
            if raw < TRIGGER_OFF {
                self.st.trigger_latched = false;
            }
        } else if raw >= TRIGGER_ON {
            self.st.trigger_latched = true;
        }
        self.st.trigger_latched
    }

    fn select_may_join(&self, now_us: u64) -> bool {
        self.st.select_join_us == 0 || now_us >= self.st.select_join_us
    }

    fn paint(&self, buttons: &mut [f32], now_us: u64) {
        let edit = self.cfg.edit;
        let select = self.cfg.select;
        if edit >= 0 {
            let i = edit as usize;
            if i < buttons.len() {
                if self.st.stage.held() {
                    buttons[i] = 1.0;
                } else if self.st.stage == Stage::Confirm {
                    buttons[i] = 0.0;
                }
            }
        }
        if select >= 0 {
            let i = select as usize;
            if i < buttons.len() {
                if self.st.stage == Stage::Tile && self.select_may_join(now_us) {
                    buttons[i] = 1.0;
                } else if self.st.stage != Stage::Idle {
                    buttons[i] = 0.0;
                }
            }
        }
    }

    fn wire_ok(&self, buttons: &[f32], now_us: u64) -> bool {
        let edit_on = button_down(buttons, self.cfg.edit);
        let select_on = button_down(buttons, self.cfg.select);
        match self.st.stage {
            Stage::Open | Stage::Settle => edit_on && !select_on,
            Stage::Tile => {
                if !self.select_may_join(now_us) {
                    // Edit-alone gate — still a valid wire for this micro-phase.
                    edit_on && !select_on
                } else {
                    edit_on && select_on
                }
            }
            Stage::Confirm => !edit_on && !select_on,
            Stage::Idle => false,
        }
    }

    /// True when the tile pick (edit+select) is actually on the wire.
    fn tile_select_live(&self, buttons: &[f32], now_us: u64) -> bool {
        self.st.stage == Stage::Tile
            && self.select_may_join(now_us)
            && button_down(buttons, self.cfg.edit)
            && button_down(buttons, self.cfg.select)
    }

    fn advance(&mut self, us: u64) {
        let prev = self.st.stage;
        self.st.stage = self.st.stage.next();
        self.reset_stage_clock();
        self.st.breathe_until_us = if prev == Stage::Tile {
            us + DE_TILE_BREATHE_US
        } else {
            0
        };
        self.st.select_join_us = if prev == Stage::Open {
            us + DE_SELECT_JOIN_US
        } else {
            0
        };
        if self.st.stage == Stage::Open {
            self.st.cycles = self.st.cycles.saturating_add(1);
        }
        // Only confirm→open / settle→confirm may hop same-pump.
        self.st.needs_next_stage = matches!(self.st.stage, Stage::Open | Stage::Confirm);
    }

    fn stage_code(&self) -> u8 {
        match self.st.stage {
            Stage::Idle => 0,
            Stage::Open => 1,
            Stage::Tile => 2,
            Stage::Settle => 3,
            Stage::Confirm => 4,
        }
    }

    fn tile_paint_live(&self) -> bool {
        self.st.stage == Stage::Tile
            || (self.st.stage == Stage::Settle && self.st.breathe_until_us > 0)
    }

    fn want_burst(&self) -> u8 {
        if self.tile_paint_live() {
            return 6;
        }
        if self.st.stage == Stage::Open {
            return 3;
        }
        0
    }

    fn process(&mut self, buttons: &mut [f32], now_us: u64) -> i64 {
        self.st.needs_next_stage = false;

        if !self.cfg.enabled || self.cfg.edit < 0 || self.cfg.select < 0 {
            self.go_idle();
            return -1;
        }

        let held = self.trigger_held(buttons);

        if held || self.st.stage != Stage::Idle {
            let t = self.cfg.trigger;
            if t >= 0 {
                let i = t as usize;
                if i < buttons.len() {
                    buttons[i] = 0.0;
                }
            }
        }

        if !held {
            self.go_idle();
            return -1;
        }

        if self.st.stage == Stage::Idle {
            self.st.stage = Stage::Open;
            self.reset_stage_clock();
            self.st.breathe_until_us = 0;
            self.st.select_join_us = 0;
        }

        // Post-tile breathe: keep edit+select.
        if self.st.stage == Stage::Settle
            && self.st.breathe_until_us > 0
            && now_us < self.st.breathe_until_us
        {
            if self.cfg.edit >= 0 {
                let i = self.cfg.edit as usize;
                if i < buttons.len() {
                    buttons[i] = 1.0;
                }
            }
            if self.cfg.select >= 0 {
                let i = self.cfg.select as usize;
                if i < buttons.len() {
                    buttons[i] = 1.0;
                }
            }
            return (self.st.breathe_until_us - now_us) as i64;
        }
        if self.st.breathe_until_us > 0 && now_us >= self.st.breathe_until_us {
            self.st.breathe_until_us = 0;
        }

        self.paint(buttons, now_us);
        if !self.wire_ok(buttons, now_us) {
            self.paint(buttons, now_us);
            if !self.wire_ok(buttons, now_us) {
                return self.wait_us(now_us);
            }
        }

        // Tile latch clock only runs while edit+select are both down.
        // Edit-alone gate frames do not eat the two-poll select budget.
        if self.st.stage == Stage::Tile && !self.tile_select_live(buttons, now_us) {
            return self.wait_us(now_us);
        }

        self.st.stage_reports = self.st.stage_reports.saturating_add(1);
        if self.st.stage_armed_us.is_none() {
            self.st.stage_armed_us = Some(now_us);
            self.st.due_us = now_us + self.stage_us(self.st.stage);
        }

        let stage_us = self.stage_us(self.st.stage);
        let armed = self.st.stage_armed_us.unwrap_or(now_us);
        let held_us = now_us.saturating_sub(armed);
        let qualified = if self.st.stage == Stage::Tile {
            self.st.stage_reports >= Self::min_reports(self.st.stage)
        } else {
            self.st.stage_reports >= Self::min_reports(self.st.stage)
                || held_us >= stage_us.saturating_mul(2)
        };

        if now_us >= self.st.due_us && qualified {
            self.advance(now_us);
        }

        self.wait_us(now_us)
    }

    fn wait_us(&self, now_us: u64) -> i64 {
        if !self.cfg.enabled || self.st.stage == Stage::Idle {
            return -1;
        }
        if self.st.stage == Stage::Tile && !self.select_may_join(now_us) {
            return self.st.select_join_us.saturating_sub(now_us) as i64;
        }
        if self.st.breathe_until_us > 0 && self.st.stage == Stage::Settle {
            return self.st.breathe_until_us.saturating_sub(now_us) as i64;
        }
        if self.st.due_us == 0 {
            return 1000;
        }
        self.st.due_us.saturating_sub(now_us) as i64
    }
}

fn button_down(buttons: &[f32], index: i32) -> bool {
    if index < 0 {
        return false;
    }
    let i = index as usize;
    i < buttons.len() && buttons[i] >= BTN_DOWN
}

static ENGINE: Mutex<Option<Engine>> = Mutex::new(None);

fn with_engine<F, R>(f: F) -> R
where
    F: FnOnce(&mut Engine) -> R,
{
    let mut guard = ENGINE.lock().unwrap_or_else(|e| e.into_inner());
    if guard.is_none() {
        *guard = Some(Engine::new());
    }
    f(guard.as_mut().unwrap())
}

#[no_mangle]
pub extern "C" fn de_set_enabled(on: u8) {
    with_engine(|e| {
        e.cfg.enabled = on != 0;
        if on == 0 {
            e.go_idle();
        }
    });
}

#[no_mangle]
pub extern "C" fn de_set_trigger(trigger: i32) {
    with_engine(|e| e.cfg.trigger = trigger);
}

#[no_mangle]
pub extern "C" fn de_set_tap_delay_us(us: u32) {
    with_engine(|e| e.cfg.tap_delay_us = u64::from(us).max(DE_CONFIRM_MIN_US));
}

#[no_mangle]
pub extern "C" fn de_set_binds(edit: i32, select: i32) {
    with_engine(|e| {
        e.cfg.edit = edit;
        e.cfg.select = select;
    });
}

#[no_mangle]
pub extern "C" fn de_reset() {
    with_engine(|e| e.go_idle());
}

#[no_mangle]
pub unsafe extern "C" fn de_process(values: *mut f32, count: u32, now_us: u64) -> i64 {
    if values.is_null() || count == 0 {
        return -1;
    }
    let n = (count as usize).min(BUTTON_COUNT);
    let slice = std::slice::from_raw_parts_mut(values, n);
    with_engine(|e| e.process(slice, now_us))
}

#[no_mangle]
pub extern "C" fn de_needs_next_stage() -> u8 {
    with_engine(|e| {
        if !e.cfg.enabled || e.st.stage == Stage::Idle {
            return 0;
        }
        if matches!(e.st.stage, Stage::Tile | Stage::Settle) {
            return 0;
        }
        if e.st.stage_armed_us.is_none() && e.st.due_us == 0 {
            return 1;
        }
        u8::from(e.st.needs_next_stage)
    })
}

#[no_mangle]
pub extern "C" fn de_stage() -> u8 {
    with_engine(|e| e.stage_code())
}

#[no_mangle]
pub extern "C" fn de_stage_reports() -> u32 {
    with_engine(|e| e.st.stage_reports)
}

#[no_mangle]
pub extern "C" fn de_want_burst() -> u8 {
    with_engine(|e| e.want_burst())
}

#[no_mangle]
pub extern "C" fn de_is_running() -> u8 {
    with_engine(|e| u8::from(e.st.stage != Stage::Idle))
}

#[no_mangle]
pub extern "C" fn de_wait_us(now_us: u64) -> i64 {
    with_engine(|e| e.wait_us(now_us))
}

#[no_mangle]
pub extern "C" fn de_cycles() -> u64 {
    with_engine(|e| e.st.cycles)
}

#[no_mangle]
pub extern "C" fn de_now_us() -> u64 {
    use std::sync::OnceLock;

    #[link(name = "kernel32")]
    extern "system" {
        fn QueryPerformanceCounter(lp_performance_count: *mut i64) -> i32;
        fn QueryPerformanceFrequency(lp_frequency: *mut i64) -> i32;
    }

    static FREQ: OnceLock<u64> = OnceLock::new();
    let freq = *FREQ.get_or_init(|| {
        let mut f: i64 = 0;
        unsafe {
            QueryPerformanceFrequency(&mut f);
        }
        if f <= 0 {
            1
        } else {
            f as u64
        }
    });
    let mut counter: i64 = 0;
    unsafe {
        QueryPerformanceCounter(&mut counter);
    }
    if counter <= 0 {
        return 0;
    }
    ((counter as u128) * 1_000_000u128 / (freq as u128)) as u64
}
