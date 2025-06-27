# 🎯 Force Tuning Quick Reference

## 🔬 **Current Force Analysis Summary**

Your simulation applies **100-300 N** user interaction forces, which corresponds to:

### **Biological Equivalent:** 
**Medical/Surgical Manipulation** (50-200 N range)

### **What it feels like:**
- Manipulating tissue with medical instruments
- Deep tissue massage 
- Surgical palpation
- Strong finger pressure on firm tissue

---

## ⚙️ **Force Realism Scale Settings**

Use the new **"Force Realism Scale"** parameter in the Physics panel:

### **Light Touch Realism** 
```
Force Realism Scale: 0.1
Result: 10-30 N forces
Feels like: Gentle finger touch on soft skin
```

### **Firm Touch Realism**
```
Force Realism Scale: 0.3  
Result: 30-90 N forces
Feels like: Firm finger pressure, poking tissue
```

### **Current Default**
```
Force Realism Scale: 1.0
Result: 100-300 N forces  
Feels like: Medical examination, deep massage
```

### **Strong Manipulation**
```
Force Realism Scale: 2.0
Result: 200-600 N forces
Feels like: Surgical manipulation, forceful pressing
```

---

## 🧪 **Live Force Monitoring**

The simulation now logs force analysis every second while you interact:

```
🔬 [FORCE ANALYSIS] User Interaction Forces vs. Biological Reality
📊 Force Statistics (last 50 samples):
   Average: 156.3 N
   Range: 23.1 - 287.4 N
   Closest biological equivalent: Surgical manipulation
📏 Biological Force Ranges:
   Light touch: 0.5-2 N
   Firm press: 5-20 N  
   Strong press: 20-50 N
   Medical palpation: 5-25 N
   Surgical manipulation: 50-200 N
💡 Current forces feel like: Medical/surgical manipulation
   For realistic finger touch, reduce forces by 15.6x
```

---

## 🎮 **Quick Tuning Guide**

### **Want realistic finger touch?**
→ Set Force Realism Scale to **0.1-0.2**

### **Want medical examination feel?**
→ Set Force Realism Scale to **0.5-1.0** (current)

### **Want strong manipulation feel?**
→ Set Force Realism Scale to **1.5-2.0**

### **Want debugging/testing?**
→ Keep at **1.0** for predictable behavior

---

## 📊 **Technical Details**

Your simulation converts screen drag distance to force:
```
Base Force = dragDistance × strength(300-500) × 0.02 × realismScale
Clamped to: 800N × realismScale maximum
```

**Spring resistance force:**
```
Spring Force = springStiffness(~158 N/m) × displacement
Typical range: 16-158 N for 0.1-1.0 unit displacement
```

The force balance determines how responsive vs. stable the interaction feels.
