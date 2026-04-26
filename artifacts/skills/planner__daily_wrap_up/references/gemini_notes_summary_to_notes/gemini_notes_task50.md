## Gemini Notes
[Gemini Notes Document](https://docs.google.com/document/d/142N2VFtamrMubQ_3xW1A8b1qTIEbqt5mNL2BVVL97E0/edit)

### Summary

The Analytics Agent review detailed the 3-layer security architecture and safeguards against indirect health information, with rule auditing by Prodsec required.

**Plugin Security and Risks**  
The Analytics Agent enables access to BigQuery, increasing the risk of cross-referencing level 1 data containing indirect health information. Plugin deployment is now automatic, being installed by default behind the Doctolib base.

**Implemented Security Safeguards**  
Security relies on 3 main layers: Risk Assessment, Query Rewriter, and Response Filter, to limit the transfer of sensitive data. Rules block re-identification through minimum aggregation of 10 rows and join restrictions.

**Rule Validation and Auditing**  
The team targets zero false negatives, preventing high-risk queries from being executed and transferred outside of Europe. It is essential that Prodsec and the legal team formally validate the risk assessment rules and perform penetration testing.
