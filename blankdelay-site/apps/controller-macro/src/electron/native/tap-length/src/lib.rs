//! Per-button tap-length floor for the ViGEm path.
//!
//! Applied to **physical input only** (before macros) so macro release edges
//! for Build pull-out / weapon slots are never re-pinned.
//!
//! On short tap: hold the button ≥ `length_us`, then release.
//! On retrigger while still forcing: emit one release frame first so the game
//! sees a clean edge (required for gun switch / build piece cycle).

use std::sync::Mutex;

const BUTTON_COUNT: usize = 24;
const MAX_US: u32 = 10_000; // 10.00 ms
const DOWN: f32 = 0.35;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Phase {
    Idle,
    Down,
    Forced,
}

struct Slot {
    length_us: u32,
    down_since_us: Option<u64>,
    phase: Phase,
}

impl Default for Slot {
    fn default() -> Self {
        Self {
            length_us: 0,
            down_since_us: None,
            phase: Phase::Idle,
        }
    }
}

struct Engine {
    slots: [Slot; BUTTON_COUNT],
}

impl Engine {
    fn new() -> Self {
        Self {
            slots: std::array::from_fn(|_| Slot::default()),
        }
    }

    fn set_length(&mut self, index: u32, us: u32) {
        if (index as usize) >= BUTTON_COUNT {
            return;
        }
        self.slots[index as usize].length_us = us.min(MAX_US);
    }

    fn reset(&mut self) {
        for slot in &mut self.slots {
            slot.down_since_us = None;
            slot.phase = Phase::Idle;
        }
    }

    /// Apply floors in-place. Returns microseconds until next forced release,
    /// or `-1` when nothing is pending.
    fn apply(&mut self, values: &mut [f32], now_us: u64) -> i64 {
        let mut next_wake: Option<u64> = None;

        for (i, value) in values.iter_mut().enumerate() {
            let slot = &mut self.slots[i];
            let want_down = *value >= DOWN;
            let floor = slot.length_us;

            if floor == 0 {
                slot.down_since_us = None;
                slot.phase = if want_down { Phase::Down } else { Phase::Idle };
                continue;
            }

            match slot.phase {
                Phase::Idle => {
                    if want_down {
                        slot.phase = Phase::Down;
                        slot.down_since_us = Some(now_us);
                        *value = 1.0;
                    }
                }
                Phase::Down => {
                    if want_down {
                        *value = 1.0;
                    } else if let Some(start) = slot.down_since_us {
                        let elapsed = now_us.saturating_sub(start);
                        if elapsed < u64::from(floor) {
                            // Physical released early — extend to the floor.
                            slot.phase = Phase::Forced;
                            *value = 1.0;
                            let due = start + u64::from(floor);
                            next_wake = Some(match next_wake {
                                Some(n) => n.min(due),
                                None => due,
                            });
                        } else {
                            slot.phase = Phase::Idle;
                            slot.down_since_us = None;
                            *value = 0.0;
                        }
                    } else {
                        slot.phase = Phase::Idle;
                        *value = 0.0;
                    }
                }
                Phase::Forced => {
                    if want_down {
                        // New press while extending — stay down as a new hold.
                        // A forced release gap here skipped guns / double-tapped UI.
                        slot.phase = Phase::Down;
                        slot.down_since_us = Some(now_us);
                        *value = 1.0;
                    } else if let Some(start) = slot.down_since_us {
                        let elapsed = now_us.saturating_sub(start);
                        if elapsed < u64::from(floor) {
                            *value = 1.0;
                            let due = start + u64::from(floor);
                            next_wake = Some(match next_wake {
                                Some(n) => n.min(due),
                                None => due,
                            });
                        } else {
                            slot.phase = Phase::Idle;
                            slot.down_since_us = None;
                            *value = 0.0;
                        }
                    } else {
                        slot.phase = Phase::Idle;
                        *value = 0.0;
                    }
                }
            }
        }

        match next_wake {
            Some(due) if due > now_us => (due - now_us) as i64,
            Some(_) => 0, // immediate follow-up (retrigger release gap)
            None => -1,
        }
    }
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
pub extern "C" fn tap_length_set(index: u32, us: u32) {
    with_engine(|e| e.set_length(index, us));
}

#[no_mangle]
pub extern "C" fn tap_length_clear() {
    with_engine(|e| {
        for i in 0..BUTTON_COUNT as u32 {
            e.set_length(i, 0);
        }
        e.reset();
    });
}

#[no_mangle]
pub extern "C" fn tap_length_reset() {
    with_engine(|e| e.reset());
}

#[no_mangle]
pub unsafe extern "C" fn tap_length_apply(
    values: *mut f32,
    count: u32,
    now_us: u64,
) -> i64 {
    if values.is_null() || count == 0 {
        return -1;
    }
    let n = (count as usize).min(BUTTON_COUNT);
    let slice = std::slice::from_raw_parts_mut(values, n);
    with_engine(|e| e.apply(slice, now_us))
}

#[no_mangle]
pub extern "C" fn tap_length_now_us() -> u64 {
    use std::sync::OnceLock;
    static FREQ: OnceLock<u64> = OnceLock::new();

    #[link(name = "kernel32")]
    extern "system" {
        fn QueryPerformanceCounter(lp_performance_count: *mut i64) -> i32;
        fn QueryPerformanceFrequency(lp_frequency: *mut i64) -> i32;
    }

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
