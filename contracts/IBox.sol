// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

/// @title Membes box interface
interface IBox {

  /////////
  // events
  /////////

  event AdminAdded(address indexed caller, address indexed account);
  event AdminRemoved(address indexed caller, address indexed account);
  event ContractPaused(address indexed caller);
  event ContractUnpaused(address indexed caller);
  event CampaignFeeChanged(address indexed caller, uint256 fee);
  event FeesWithdrawn(address indexed caller, uint256 indexed balance);
  event CampaignCreated(uint256 indexed campaignId, address author);
  event CampaignResumed(uint256 indexed campaignId);
  event CampaignSuspended(uint256 indexed campaignId);
  event CampaignCancelled(uint256 indexed campaignId);
  event RewardClaimed(uint256 indexed campaignId, address indexed caller);
  event RewardWithdrawn(uint256 indexed campaignId, address indexed caller);

  ///////////////
  /// admin calls
  ///////////////

  function addContractAdmin(address _account) external returns (bool);

  function removeContractAdmin(address _account) external returns (bool);

  function pauseContract() external returns (bool);

  function unpauseContract() external returns (bool);

  function setCampaignFee(uint256 _fee) external returns (bool);

  function withdrawFees() external returns (bool);

  /////////////////
  // campaign calls
  /////////////////

  function createCampaign (address _token, uint256 _balance, uint256 _claim, bool _active) payable external returns (uint256);

  function suspendCampaign (uint256 _campaignId) external returns (bool);

  function resumeCampaign (uint256 _campaignId) external returns (bool);

  function cancelCampaign (uint256 _campaignId) external returns (bool);

  ////////////////////
  // beneficiary calls
  ////////////////////

  function claimReward(uint256 _campaignId, string memory _nonce, bytes calldata _signature) external returns (bool);

  function getReward(uint256 _campaignId) external view returns (uint256);

  function withdrawReward(uint256 _campaignId) external returns (bool);

  //////////////
  /// view calls
  //////////////

  // contract
  function getContractAdminCount() external view returns (uint256);

  function getContractAdmin(uint256 _campaignId) external view returns (address);

  function isContractAdmin(address _account) external view returns (bool);

  // campaign
  function isCampaignAdmin(uint256 _campaignId, address _account) external view returns (bool);

  function getCampaignBeneficiaryCount(uint256 _campaignId) external view returns (uint256);

  function getCampaignBeneficiary(uint256 _campaignId, uint256 _userId) external view returns (address);

  function isCampaignBeneficiary(uint256 _campaignId, address _account) external view returns (bool);

  // user
  function userClaimsCount(address _account) external view returns (uint256);

  function getUserClaim(address _account, uint256 _id) external view returns (uint256);
}
