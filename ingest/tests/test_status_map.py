import unittest

from ingest.status_map import commodity_for, status_class
from ingest.sources import SOURCES


class StatusMapTests(unittest.TestCase):
    def table(self, state):
        for src in SOURCES:
            if src["state"] == state:
                return src["status_table"]
        raise AssertionError(state)

    def test_texas(self):
        table = self.table("TX")
        self.assertEqual(status_class("Gas Well", table), "active")
        self.assertEqual(status_class("Shut-In Gas", table), "inactive")
        self.assertEqual(status_class("Plugged Gas Well", table), "plugged")
        self.assertEqual(status_class("Plugged Oil / Gas", table), "plugged")
        self.assertEqual(commodity_for("TX", "Oil/Gas Well"), "oil_gas_combined")
        self.assertEqual(commodity_for("TX", "Gas Well"), "gas")

    def test_new_mexico(self):
        table = self.table("NM")
        self.assertEqual(status_class("Active", table), "active")
        self.assertEqual(status_class("Temporary Abandonment", table), "inactive")
        self.assertEqual(status_class("Plugged (site released)", table), "plugged")
        self.assertEqual(status_class("TA (expired)", table), "inactive")

    def test_colorado(self):
        table = self.table("CO")
        self.assertEqual(status_class("PR", table), "active")
        self.assertEqual(status_class("SI", table), "inactive")
        self.assertEqual(status_class("TA", table), "inactive")
        self.assertEqual(status_class("PA", table), "plugged")

    def test_pennsylvania_west_virginia_oklahoma(self):
        self.assertEqual(status_class("Active", self.table("PA")), "active")
        self.assertEqual(status_class("Regulatory Inactive Status", self.table("PA")), "inactive")
        self.assertEqual(status_class("Active Well", self.table("WV")), "active")
        self.assertEqual(status_class("Shutin", self.table("WV")), "inactive")
        self.assertEqual(status_class("AC", self.table("OK")), "active")
        self.assertEqual(status_class("TA", self.table("OK")), "inactive")
        self.assertEqual(status_class("PA", self.table("OK")), "plugged")

    def test_ohio_louisiana(self):
        self.assertEqual(status_class("Producing", self.table("OH")), "active")
        self.assertEqual(status_class("Well Drilled", self.table("OH")), "inactive")
        self.assertEqual(status_class("10", self.table("LA")), "active")
        self.assertEqual(status_class("33", self.table("LA")), "inactive")
        self.assertEqual(status_class("30", self.table("LA")), "plugged")

    def test_remaining_states(self):
        pairs = [
            ("UT", "Producing", "active"),
            ("UT", "Shut-in", "inactive"),
            ("UT", "Plugged & Abandoned", "plugged"),
            ("UT", "Temporarily-abandoned", "inactive"),
            ("AR", "Abandoned/Orphaned Well", "other"),
            ("MI", "Shut_In", "inactive"),
            ("AR", "Temporarily Abandoned", "inactive"),
            ("NY", "AC", "active"),
            ("NY", "SI", "inactive"),
            ("VA", "Producing", "active"),
            ("VA", "Shut In", "inactive"),
            ("MT", "P&A - Approved", "plugged"),
            ("AL", "Temporarily Abandoned", "inactive"),
            ("ND", "A", "active"),
            ("ND", "TA", "inactive"),
            ("KS", "GAS", "active"),
            ("KS", "GAS-P&A", "plugged"),
            ("WY", "PG", "active"),
            ("WY", "SI", "inactive"),
            ("CA", "Idle", "inactive"),
            ("MS", "CI/TA", "inactive"),
            ("MS", "CI", "inactive"),
            ("TN", "Shut-in Gas", "inactive"),
            ("TN", "Gas", "active"),
            ("SD", "Producing", "active"),
            ("NE", "PR", "active"),
            ("NE", "SI", "inactive"),
            ("AK", "1-GAS", "active"),
        ]
        for state, raw, kind in pairs:
            self.assertEqual(status_class(raw, self.table(state)), kind, f"{state} {raw}")

    def test_unknown_when_unmapped(self):
        self.assertEqual(status_class("", self.table("NM")), "unknown")
        self.assertEqual(status_class("not a status", self.table("PA")), "unknown")

    def test_nd_combined_commodity(self):
        self.assertEqual(commodity_for("ND", "OG"), "oil_gas_combined")
        self.assertEqual(commodity_for("ND", "GASD"), "gas")


if __name__ == "__main__":
    unittest.main()
