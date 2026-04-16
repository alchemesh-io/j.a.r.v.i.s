## Gemini Notes
[Gemini Notes Document](https://docs.google.com/document/d/142N2VFtamrMubQ_3xW1A8b1qTIEbqt5mNL2BVVL97E0/edit)

### Summary

Permission framework discussion centered on data contract requirements, data product infrastructure, and controller management for cluster monitoring and provisioning.

**Product Contract Requirements Defined**  
The initial discussion focused on the permission framework domain, specifically the necessary components like the data contract, metabase proxy, and contract actions, which require the creation of a product contract or a contract pair.

**Infrastructure and Contract Status**  
The group established that the data product is infrastructure and confirmed that a valid contract is required for a subscription; therefore, the contract status must not be “not ready” for a product.

**Controller Management and Provisioning**  
The conversation concluded that a dedicated controller should be implemented to watch the contract and cluster events, allowing for the automatic provisioning of the linked data set for a full data project.