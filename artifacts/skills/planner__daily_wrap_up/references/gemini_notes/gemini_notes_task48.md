### Summary

Permission framework discussion centered on data contract requirements, data product infrastructure, and controller management for cluster monitoring and provisioning.

**Product Contract Requirements Defined**  
The initial discussion focused on the permission framework domain, specifically the necessary components like the data contract, metabase proxy, and contract actions, which require the creation of a product contract or a contract pair.

**Infrastructure and Contract Status**  
The group established that the data product is infrastructure and confirmed that a valid contract is required for a subscription; therefore, the contract status must not be “not ready” for a product.

**Controller Management and Provisioning**  
The conversation concluded that a dedicated controller should be implemented to watch the contract and cluster events, allowing for the automatic provisioning of the linked data set for a full data project.

### Next steps

- [ ] \[Alexandre Guitton\] Get Resource: Obtain the requested item.

### Details

* **Permission Framework and Domain Synchronization**: The discussion began with a focus on the permission framework domain, specifically mentioning name synchronization. The conversation also detailed components like the data contract, metabase proxy, and contract actions, emphasizing the need for a creation of a product contract, or even a contract pair.

* **Data Contract and Resource Naming**: The speakers reviewed the role of the data contract controller, noting that it watches the namespace data domain, with resources including the data contract plus subscription watch. They established that naming should be done by naming the resource and that a valid contract is required for a subscription.

* **Data Set and Contract Status Monitoring**: The group discussed the status of contracts, noting that the status should not be "not ready" for a product and emphasizing that monitoring the contract is necessary. The possibility of creating a contract for a subscription was also brought up, along with a concern regarding the differences in discretion.

* **Project Identification and Infrastructure**: The discussion shifted to new problems related to the project ID and contract, where Alexandre Guitton confirmed that the data product is infrastructure. They touched upon input communication and magic control to manage the present status, concluding that a test and twin setup is good.

* **Controller Management and Data Project**: They explored the development controller and the need for a controller to take over, noting that the controller should watch the contract. The speakers then discussed transforming a proxy and provisioning the linked data set for a full data project.

* **Data Set Provisioning and Listing**: Alexandre Guitton mentioned provisioning the linked data set and brought up that a data set is shown and confirmed the automatic process for the contract data product. They clarified that the listing exchange was clear and that tools are needed to check out the contract structure.

* **Cluster Contract Monitoring and Status Check**: The group discussed contract problems for mobile and the need for additional team support, agreeing that a controller should watch the event cluster. They concluded that the controller should specifically watch contracts and the cluster startup, and then checked the status of the product and data contract output.

*You should review Gemini's notes to make sure they're accurate. [Get tips and learn how Gemini takes notes](https://support.google.com/meet/answer/14754931)*

*How is the quality of **these specific notes?** [Take a short survey](https://google.qualtrics.com/jfe/form/SV_9vK3UZEaIQKKE7A?confid=Uc5sokRmWeSQ_vFZB-vhDxIQOAIIigIgAhgDCA&detailid=standard&screenshot=false) to let us know your feedback, including how helpful the notes were for your needs.*