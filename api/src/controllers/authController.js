import { generateAccessToken, generateRefreshToken } from "../config/jwt.js";
import User from "../models/user.js";

// 🧩 Register User
export const register = async (req, res) => {
  try {
    const { phone, displayName, password } = req.body;

    // Validate input
    if (!phone || !displayName || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({ error: "Phone already registered" });
    }

    // Create new user
    const user = await User.create({ phone, displayName, password });

    // Generate JWT tokens
    const accessToken = generateAccessToken(user._id, user.phone);
    const refreshToken = generateRefreshToken(user._id);

    res.status(201).json({
      user: {
        id: user._id,
        phone: user.phone,
        displayName: user.displayName,
        avatar: user.avatar,
        status: user.status,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// 🧩 Login User
export const login = async (req, res) => {
  try {
    
    const { phone, password } = req.body;
    console.log("🚀 ~ login ~ req.body", req.body)

    if (!phone || !password) {
      return res.status(400).json({ error: "Phone and password required" });
    }

    // Find user with password
    const user = await User.findOne({ phone }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT tokens
    const accessToken = generateAccessToken(user._id, user.phone);
    const refreshToken = generateRefreshToken(user._id);

    res.json({
      user: {
        id: user._id,
        phone: user.phone,
        displayName: user.displayName,
        avatar: user.avatar,
        status: user.status,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// 🧩 Get Authenticated User
export const getMe = async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    console.error("GetMe error:", error);
    res.status(500).json({ error: "Server error" });
  }
};
