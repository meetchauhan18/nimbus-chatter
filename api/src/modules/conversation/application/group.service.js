/**
 * Group Service
 * Business logic for group-specific operations
 */
export class GroupService {
  constructor({ conversationRepository, userRepository, eventBus, logger }) {
    this.conversationRepository = conversationRepository;
    this.userRepository = userRepository;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  /**
   * Add participants to group
   */
  async addParticipants(conversationId, adminUserId, userIds) {
    const conversation =
      await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error("Group not found");
    }

    if (conversation.type !== "group") {
      throw new Error("This is not a group conversation");
    }

    // Check admin privileges
    if (!conversation.hasAdminPrivileges(adminUserId)) {
      throw new Error("Only admins can add participants");
    }

    // Prepare new participants
    const addedUsers = [];
    const participantData = [];

    for (const userId of userIds) {
      // Skip if already a participant
      if (conversation.isParticipant(userId)) {
        continue;
      }

      participantData.push({
        user: userId,
        role: "member",
        joinedAt: new Date(),
      });

      addedUsers.push(userId);
    }

    if (participantData.length === 0) {
      throw new Error("No new participants to add");
    }

    // Add participants
    const updated = await this.conversationRepository.addParticipants(
      conversationId,
      participantData
    );

    // Emit event
    this.eventBus.emit("group.participants.added", {
      conversationId: conversationId.toString(),
      adminUserId: adminUserId.toString(),
      addedUserIds: addedUsers.map((id) => id.toString()),
    });

    this.logger.info("Participants added to group", {
      conversationId,
      count: addedUsers.length,
    });

    return {
      message: "Participants added successfully",
      addedUsers,
      conversation: updated,
    };
  }

  /**
   * Remove participant from group
   */
  async removeParticipant(conversationId, adminUserId, targetUserId) {
    const conversation =
      await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error("Group not found");
    }

    if (conversation.type !== "group") {
      throw new Error("This is not a group conversation");
    }

    // Check admin privileges
    if (!conversation.hasAdminPrivileges(adminUserId)) {
      throw new Error("Only admins can remove participants");
    }

    // Can't remove the owner
    if (conversation.isOwner(targetUserId)) {
      throw new Error("Cannot remove the group owner");
    }

    // Can't remove yourself if you're the owner
    if (adminUserId === targetUserId && conversation.isOwner(adminUserId)) {
      throw new Error("Owner cannot leave without transferring ownership");
    }

    // Remove participant
    await this.conversationRepository.removeParticipant(
      conversationId,
      targetUserId
    );

    // If they were admin, remove from admins array
    if (conversation.isAdmin(targetUserId)) {
      conversation.demoteFromAdmin(targetUserId);
      await conversation.save();
    }

    // Emit event
    this.eventBus.emit("group.participant.removed", {
      conversationId: conversationId.toString(),
      adminUserId: adminUserId.toString(),
      removedUserId: targetUserId.toString(),
    });

    this.logger.info("Participant removed from group", {
      conversationId,
      removedUserId: targetUserId,
    });

    return {
      message: "Participant removed successfully",
      removedUserId: targetUserId,
    };
  }

  /**
   * Leave group (self-remove)
   */
  async leaveGroup(conversationId, userId) {
    const conversation =
      await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error("Group not found");
    }

    if (conversation.type !== "group") {
      throw new Error("This is not a group conversation");
    }

    // Owner must transfer ownership before leaving
    if (conversation.isOwner(userId)) {
      throw new Error("Owner must transfer ownership before leaving");
    }

    // Remove user
    await this.conversationRepository.removeParticipant(conversationId, userId);

    // Remove from admins if applicable
    if (conversation.isAdmin(userId)) {
      conversation.demoteFromAdmin(userId);
      await conversation.save();
    }

    // Emit event
    this.eventBus.emit("group.user.left", {
      conversationId: conversationId.toString(),
      userId: userId.toString(),
    });

    this.logger.info("User left group", { conversationId, userId });

    return { message: "Left group successfully" };
  }

  /**
   * Promote user to admin
   */
  async promoteToAdmin(conversationId, ownerId, targetUserId) {
    const conversation =
      await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error("Group not found");
    }

    if (conversation.type !== "group") {
      throw new Error("This is not a group conversation");
    }

    // Only owner can promote
    if (!conversation.isOwner(ownerId)) {
      throw new Error("Only the group owner can promote users to admin");
    }

    // Check if target is participant
    if (!conversation.isParticipant(targetUserId)) {
      throw new Error("User is not a participant");
    }

    // Check if already admin
    if (conversation.isAdmin(targetUserId)) {
      throw new Error("User is already an admin");
    }

    // Promote to admin
    conversation.promoteToAdmin(targetUserId);
    await conversation.save();

    // Emit event
    this.eventBus.emit("group.admin.promoted", {
      conversationId: conversationId.toString(),
      ownerId: ownerId.toString(),
      promotedUserId: targetUserId.toString(),
    });

    this.logger.info("User promoted to admin", {
      conversationId,
      promotedUserId: targetUserId,
    });

    return {
      message: "User promoted to admin successfully",
      userId: targetUserId,
    };
  }

  /**
   * Demote admin to member
   */
  async demoteFromAdmin(conversationId, ownerId, targetUserId) {
    const conversation =
      await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error("Group not found");
    }

    if (conversation.type !== "group") {
      throw new Error("This is not a group conversation");
    }

    // Only owner can demote
    if (!conversation.isOwner(ownerId)) {
      throw new Error("Only the group owner can demote admins");
    }

    // Can't demote the owner
    if (conversation.isOwner(targetUserId)) {
      throw new Error("Cannot demote the group owner");
    }

    // Check if user is admin
    if (!conversation.isAdmin(targetUserId)) {
      throw new Error("User is not an admin");
    }

    // Demote from admin
    conversation.demoteFromAdmin(targetUserId);
    await conversation.save();

    // Emit event
    this.eventBus.emit("group.admin.demoted", {
      conversationId: conversationId.toString(),
      ownerId: ownerId.toString(),
      demotedUserId: targetUserId.toString(),
    });

    this.logger.info("Admin demoted", {
      conversationId,
      demotedUserId: targetUserId,
    });

    return {
      message: "Admin demoted successfully",
      userId: targetUserId,
    };
  }

  /**
   * Update group info
   */
  async updateGroupInfo(conversationId, userId, updates) {
    const conversation =
      await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error("Group not found");
    }

    if (conversation.type !== "group") {
      throw new Error("This is not a group conversation");
    }

    // Check admin privileges
    if (!conversation.hasAdminPrivileges(userId)) {
      throw new Error("Only admins can update group info");
    }

    // Update group info
    conversation.updateGroupInfo(updates);
    await conversation.save();

    // Emit event
    this.eventBus.emit("group.info.updated", {
      conversationId: conversationId.toString(),
      userId: userId.toString(),
      updates,
    });

    this.logger.info("Group info updated", { conversationId, updates });

    return {
      message: "Group info updated successfully",
      group: conversation.group,
    };
  }

  /**
   * Transfer ownership
   */
  async transferOwnership(conversationId, currentOwnerId, newOwnerId) {
    const conversation =
      await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error("Group not found");
    }

    if (conversation.type !== "group") {
      throw new Error("This is not a group conversation");
    }

    // Only owner can transfer ownership
    if (!conversation.isOwner(currentOwnerId)) {
      throw new Error("Only the owner can transfer ownership");
    }

    // Check if new owner is participant
    if (!conversation.isParticipant(newOwnerId)) {
      throw new Error("New owner must be a participant");
    }

    // Update owner
    conversation.group.createdBy = newOwnerId;

    // Make new owner admin if not already
    if (!conversation.isAdmin(newOwnerId)) {
      conversation.promoteToAdmin(newOwnerId);
    }

    // Update participant roles
    conversation.updateParticipantRole(newOwnerId, "owner");
    conversation.updateParticipantRole(currentOwnerId, "admin");

    await conversation.save();

    // Emit event
    this.eventBus.emit("group.ownership.transferred", {
      conversationId: conversationId.toString(),
      previousOwnerId: currentOwnerId.toString(),
      newOwnerId: newOwnerId.toString(),
    });

    this.logger.info("Ownership transferred", {
      conversationId,
      newOwnerId,
    });

    return {
      message: "Ownership transferred successfully",
      newOwnerId,
    };
  }

  /**
   * Get group members
   */
  async getGroupMembers(conversationId, userId) {
    const conversation = await this.conversationRepository.findById(
      conversationId,
      userId
    );

    if (!conversation) {
      throw new Error("Group not found");
    }

    if (conversation.type !== "group") {
      throw new Error("This is not a group conversation");
    }

    // Check if user is participant
    if (!conversation.isParticipant(userId)) {
      throw new Error("You are not a member of this group");
    }

    return {
      participants: conversation.participants,
      admins: conversation.admins,
      owner: conversation.group.createdBy,
    };
  }
}
