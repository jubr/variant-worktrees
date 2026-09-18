# Test quality

Test observable behavior through the narrowest stable seam. Prefer a public round trip that survives an internal rewrite with the same contract.

## Keep a test when it

- names a capability or outcome;
- covers one logical behavior, with as many assertions as that outcome needs;
- derives expected results from a requirement, worked example, invariant, or known literal;
- fails only when the contract breaks.

One focused RED may use a parameterized or table-driven test with multiple examples of the same behavior. Never use a case table to batch independent behaviors.

The expected value must be able to disagree with the implementation:

```javascript
// Weak: repeats the production rule
expect(calculateTax(100)).toBe(100 * TAX_RATE);

// Strong: uses a reviewed example from the requirement
expect(calculateTax(100)).toBe(21);
```

Avoid private methods, internal call order, incidental data structures, and other details callers cannot observe. Inspect storage, emitted messages, or protocol calls directly only when that side effect is the contract or no stable public observation exists.
