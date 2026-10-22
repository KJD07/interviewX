from django.test import SimpleTestCase

from .openrouter_client import build_interview_system_prompt


class TonePromptTests(SimpleTestCase):
    """Covers the bug where seed data used tone_style values like
    'formal_strict' / 'casual_friendly' but the prompt builder's dict only
    had keys 'formal' / 'casual' / 'aggressive', so every seeded company
    silently fell through to the generic fallback tone."""

    def _questions(self):
        return [{"question_type": "technical", "question_text": "Explain closures."}]

    def test_formal_strict_gets_specific_instructions(self):
        prompt = build_interview_system_prompt(
            company_name="Acme",
            company_tone="formal_strict",
            role_title="SDE-2",
            round_title="Technical Round 1",
            questions=self._questions(),
        )
        self.assertIn("professional, precise, and measured", prompt)
        self.assertNotIn("Your tone is formal_strict", prompt)

    def test_casual_friendly_gets_specific_instructions(self):
        prompt = build_interview_system_prompt(
            company_name="Acme",
            company_tone="casual_friendly",
            role_title="SDE-2",
            round_title="Technical Round 1",
            questions=self._questions(),
        )
        self.assertIn("relaxed and conversational", prompt)
        self.assertNotIn("Your tone is casual_friendly", prompt)

    def test_unknown_tone_falls_back_gracefully(self):
        prompt = build_interview_system_prompt(
            company_name="Acme",
            company_tone="quirky",
            role_title="SDE-2",
            round_title="Technical Round 1",
            questions=self._questions(),
        )
        self.assertIn("Your tone is quirky", prompt)


class GraphRunnerTests(SimpleTestCase):
    def test_static_edges_and_merge(self):
        from .graph import Graph, path
        g = (Graph("t").node("a", lambda s: {"x": 1}).node("b", lambda s: {"y": s["x"] + 1})
             .edge("a", "b"))
        state, trace = g.run({"x": 0})
        self.assertEqual(state, {"x": 1, "y": 2})
        self.assertEqual(path(trace), ["a", "b"])
        self.assertTrue(all(t["error"] is None for t in trace))

    def test_router_picks_branch_and_end(self):
        from .graph import END, Graph, path
        g = (Graph("t").node("start", lambda s: None).node("hi", lambda s: {"out": "hi"})
             .node("lo", lambda s: {"out": "lo"})
             .route("start", lambda s: "hi" if s["n"] > 5 else "lo")
             .route("hi", lambda s: END))
        self.assertEqual(g.run({"n": 9})[0]["out"], "hi")
        state, trace = g.run({"n": 1})
        self.assertEqual((state["out"], path(trace)), ("lo", ["start", "lo"]))

    def test_error_fallback_and_propagation(self):
        from .graph import Graph, path

        def boom(s):
            raise ValueError("x")
        g = Graph("t").node("a", boom).node("safe", lambda s: {"ok": True}).on_error("a", "safe")
        state, trace = g.run()
        self.assertTrue(state["ok"])
        self.assertEqual(path(trace), ["a", "safe"])
        self.assertEqual(trace[0]["error"], "ValueError")
        with self.assertRaises(ValueError):
            Graph("t2").node("a", boom).run()

    def test_max_steps_guard_and_unknown_route(self):
        from .graph import Graph, GraphError
        loop = Graph("loop", max_steps=5).node("a", lambda s: None).edge("a", "a")
        with self.assertRaises(GraphError):
            loop.run()
        exact = Graph("ok", max_steps=2).node("a", lambda s: None).node("b", lambda s: None).edge("a", "b")
        exact.run()  # exactly max_steps nodes is fine
        bad = Graph("bad").node("a", lambda s: None).route("a", lambda s: "nope")
        with self.assertRaises(GraphError):
            bad.run()
