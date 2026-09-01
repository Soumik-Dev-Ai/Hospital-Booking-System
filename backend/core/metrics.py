"""
core/metrics.py — Lightweight in-memory metrics for the system health dashboard.

Tracks:
  - Counters: increment(name, value=1)
  - Histograms: observe(name, duration_seconds)

All data lives in-process. Multi-worker deployments need an external store (Prometheus, etc.).
"""
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Metrics:
    counters: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    histograms: dict[str, list[float]] = field(default_factory=lambda: defaultdict(list))

    def increment(self, name: str, value: int = 1) -> None:
        self.counters[name] += value

    def observe(self, name: str, duration_seconds: float) -> None:
        buckets = self.histograms[name]
        buckets.append(duration_seconds)
        # Trim to last 1000 observations to prevent unbounded growth
        if len(buckets) > 1000:
            self.histograms[name] = buckets[-1000:]

    def summary(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "counters": dict(self.counters),
            "histograms": {},
        }
        for name, values in self.histograms.items():
            if not values:
                continue
            sorted_vals = sorted(values)
            p95_idx = int(len(sorted_vals) * 0.95)
            p95_idx = min(p95_idx, len(sorted_vals) - 1)
            result["histograms"][name] = {
                "count": len(sorted_vals),
                "avg_ms": round(sum(sorted_vals) / len(sorted_vals) * 1000, 2),
                "p95_ms": round(sorted_vals[p95_idx] * 1000, 2),
                "max_ms": round(max(sorted_vals) * 1000, 2),
            }
        return result

    def reset(self) -> None:
        self.counters.clear()
        self.histograms.clear()


metrics = Metrics()
