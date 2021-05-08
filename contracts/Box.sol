// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import './IBox.sol';

/// @title Membes box contract
contract Box is Context, AccessControlEnumerable, Pausable, IBox {
  
  //////////
  // storage
  //////////

  using SafeERC20 for IERC20;
  using EnumerableSet for EnumerableSet.AddressSet;
  using EnumerableSet for EnumerableSet.UintSet;

  struct Campaign {
    address author;
    address token;

    uint256 balance;
    uint256 claim;

    bool active;
    bool cancelled;
    bool spent;
  }

  mapping(address => mapping(uint256 => uint256)) internal beneficiaryRewards;

  mapping(uint256 => EnumerableSet.AddressSet) internal campaignAdmins;

  mapping(uint256 => EnumerableSet.AddressSet) internal campaignBeneficiaries;
  mapping(uint256 => EnumerableSet.AddressSet) internal campaignBlacklist;

  mapping(address => EnumerableSet.UintSet) internal userClaims;

  mapping(uint256 => Campaign) public campaigns;

  mapping(address => uint256) public userCampaignCount;
  mapping(address => mapping(uint256 => uint256)) public userCampaignIds;

  mapping(uint256 => mapping(string => bool)) public nonces;

  uint256 public campaignFee;
  uint256 public campaignCount;

  //////////////
  // constructor
  //////////////

  constructor () {
    _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
  }

  ////////////
  // modifiers
  ////////////

  modifier onlyContractAdmin () {
    require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "Only admin");
    _;
  }

  modifier onlyCampaignAdmin (uint256 _campaignId) {
    require(campaignAdmins[_campaignId].contains(_msgSender()), "Only campaign admin");
    _;
  }

  modifier campaignExist(uint256 _campaignId) {
    require(campaigns[_campaignId].author != address(0), "Campaign does not exit");
    _;
  }

  modifier campaignIsActive(uint256 _campaignId) {
    require(campaigns[_campaignId].active == true, "Campaign active");
    require(campaigns[_campaignId].cancelled == false, "Campaign cancelled");
    require(campaigns[_campaignId].spent == false, "Campaign spent");
    _;
  }

  modifier campaignNotCancelled(uint256 _campaignId) {
    require(campaigns[_campaignId].cancelled == false, "Campaign cancelled");
    _;
  }

  ///////////////
  /// admin calls
  ///////////////

  function addContractAdmin(address _account) onlyContractAdmin public override returns (bool) {
    require(hasRole(DEFAULT_ADMIN_ROLE, _account) == false, "Already an admin");
    grantRole(DEFAULT_ADMIN_ROLE, _account);
    emit AdminAdded(_msgSender(), _account);
    return true;
  }

  function removeContractAdmin(address _account) onlyContractAdmin public override returns (bool) {
    require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) > 1, "Must have atleast one admin");
    revokeRole(DEFAULT_ADMIN_ROLE, _account);
    emit AdminRemoved(_msgSender(), _account);
    return true;
  }

  function pauseContract() onlyContractAdmin whenNotPaused public override returns (bool) {
    _pause();
    emit ContractPaused(_msgSender());
    return true;
  }

  function unpauseContract() onlyContractAdmin whenPaused public override returns (bool) {
    _unpause();
    emit ContractUnpaused(_msgSender());
    return true;
  }

  function setCampaignFee(uint256 _fee) onlyContractAdmin public override returns (bool) {
    campaignFee = _fee;
    emit CampaignFeeChanged(_msgSender(), _fee);
    return true;
  }

  function withdrawFees() onlyContractAdmin public override returns (bool) {
    emit FeesWithdrawn(_msgSender(), address(this).balance);
    payable(_msgSender()).transfer(address(this).balance);
    return true;
  }

  /////////////////
  // campaign calls
  /////////////////

  function createCampaign (
    address _token, uint256 _balance, uint256 _claim, bool _active
  )
    whenNotPaused payable public override returns (uint256)
  {
    require(msg.value >= campaignFee, "Invalid fee");

    require(_balance % _claim == 0, "Invalid 'balance % claim' must be '0'");
    require(_balance > 0, "Campaign must have rewards");

    IERC20 token = IERC20(address(_token));

    uint256 allowance = token.allowance(_msgSender(), address(this));
    require(allowance >= _balance, "Check the token allowance");
    
    token.safeTransferFrom(_msgSender(), address(this), _balance);

    campaignCount++;

    campaigns[campaignCount] = Campaign({
      author: _msgSender(),
      token: _token,

      balance: _balance,
      claim: _claim,

      active: _active,
      cancelled: false,
      spent: false
    });

    campaignAdmins[campaignCount].add(_msgSender());

    userCampaignCount[_msgSender()]++;
    userCampaignIds[_msgSender()][userCampaignCount[_msgSender()]] = campaignCount;

    emit CampaignCreated(campaignCount, _msgSender());
    return campaignCount;
  }

  function suspendCampaign (uint256 _campaignId) whenNotPaused
    campaignExist(_campaignId) onlyCampaignAdmin(_campaignId) campaignNotCancelled(_campaignId) public override returns (bool) 
  {
    campaigns[_campaignId].active = false;
    emit CampaignSuspended(_campaignId);
    return true;
  }

  function resumeCampaign (uint256 _campaignId) whenNotPaused
    campaignExist(_campaignId) onlyCampaignAdmin(_campaignId) campaignNotCancelled(_campaignId) public override returns (bool) 
  {
    campaigns[_campaignId].active = true;
    emit CampaignResumed(_campaignId);
    return true;
  }

  function cancelCampaign (uint256 _campaignId) whenNotPaused
    campaignExist(_campaignId) onlyCampaignAdmin(_campaignId) campaignNotCancelled(_campaignId) public override returns (bool)
  {
    Campaign memory _campaign = campaigns[_campaignId];

    beneficiaryRewards[_msgSender()][_campaignId] += _campaign.balance;
    userClaims[_msgSender()].add(_campaignId);

    _campaign.cancelled = true;
    _campaign.balance = 0;
    _campaign.spent = true;
    campaigns[_campaignId] = _campaign;

    emit CampaignCancelled(_campaignId);
    return true;
  }

  ////////////////////
  // beneficiary calls
  ////////////////////

  function claimReward(uint256 _campaignId, string memory _nonce, bytes calldata _signature)
    whenNotPaused campaignExist(_campaignId) campaignIsActive(_campaignId) public override returns (bool)
  {
    address signer;
    Campaign memory _campaign = campaigns[_campaignId];

    if (_campaign.balance == 0) {
      campaigns[_campaignId].spent = true;
      revert("Campaign spent");
    }

    require(nonces[_campaignId][_nonce] == false, "Nonce already used");
    nonces[_campaignId][_nonce] = true;

    bytes32 hash = keccak256(abi.encodePacked( _nonce, _msgSender() ));
    bytes32 prefixedHash = ECDSA.toEthSignedMessageHash(hash);

    (signer) = ECDSA.recover(prefixedHash, _signature);
    
    require(campaignAdmins[_campaignId].contains(signer) == true, "Unauthorized signer");

    campaignBeneficiaries[_campaignId].add(_msgSender());
    userClaims[_msgSender()].add(_campaignId);
    
    _campaign.balance -= _campaign.claim;
    beneficiaryRewards[_msgSender()][_campaignId] += _campaign.claim;

    campaigns[_campaignId] = _campaign;

    emit RewardClaimed(_campaignId, _msgSender());
    return true;
  }

  function getReward(uint256 _campaignId)
    campaignExist(_campaignId) public view override returns (uint256)
  {
    return beneficiaryRewards[_msgSender()][_campaignId];
  }

  function withdrawReward(uint256 _campaignId)
    whenNotPaused campaignExist(_campaignId) public override returns (bool)
  {
    uint256 campaignBalance = beneficiaryRewards[_msgSender()][_campaignId];

    require(campaignBalance > 0, "Has no balance");

    beneficiaryRewards[_msgSender()][_campaignId] = 0;
    userClaims[_msgSender()].remove(_campaignId);

    IERC20(address(campaigns[_campaignId].token)).safeTransfer(_msgSender(), campaignBalance);

    emit RewardWithdrawn(_campaignId, _msgSender());
    return true;
  }

  //////////////
  /// view calls
  //////////////

  // contract
  function getContractAdminCount() public view override returns (uint256) {
    return getRoleMemberCount(DEFAULT_ADMIN_ROLE);
  }

  function getContractAdmin(uint256 _campaignId) public view override returns (address) {
    return getRoleMember(DEFAULT_ADMIN_ROLE, _campaignId);
  }

  function isContractAdmin(address _account) public view override returns (bool) {
    return hasRole(DEFAULT_ADMIN_ROLE, _account);
  }

  // campaign
  function isCampaignAdmin(uint256 _campaignId, address _account) public view override returns (bool) {
    return campaignAdmins[_campaignId].contains(_account);
  }

  function getCampaignBeneficiaryCount(uint256 _campaignId) public view override returns (uint256) {
    return campaignBeneficiaries[_campaignId].length();
  }

  function getCampaignBeneficiary(uint256 _campaignId, uint256 _userId) public view override returns (address) {
    return campaignBeneficiaries[_campaignId].at(_userId);
  }

  function isCampaignBeneficiary(uint256 _campaignId, address _account) public view override returns (bool) {
    return campaignBeneficiaries[_campaignId].contains(_account);
  }

  // user
  function userClaimsCount(address _account) public view override returns (uint256) {
    return userClaims[_account].length();
  }

  function getUserClaim(address _account, uint256 _id) public view override returns (uint256) {
    return userClaims[_account].at(_id);
  }

  ///////
  // meta
  ///////

  fallback() payable external {}

  receive() payable external {}

}
